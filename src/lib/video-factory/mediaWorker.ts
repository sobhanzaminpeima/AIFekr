import { prisma } from "@/lib/db/prisma";
import { FactoryError } from "./domain";
import { saveAsset } from "./assets";
import { getMediaProvider, recordProviderHealth } from "./registry";
import { boundedBytes, generateImage, generateInstrumental, generateSpeech, pollVideo, ProviderFailure, submitVideo } from "./mediaAdapters";
import type { MediaResult } from "./mediaAdapters";
import { mediaTaskSchema, productionPlanSchema,fingerprint, type ProductionPlan } from "./production";
import { enforceUserPolicy } from "./resources";
import {agentSettings} from "./resources";
import { getPolicy } from "./config";
import { rateLimit } from "@/lib/utils/rateLimit";
import {assetBytes} from "./assets";
import {requireVoiceConsent} from "./voiceConsent";
import {cloneVoice,alignSpeech,transcribeSpeech,generateSfx,verifyClonedVoice} from "./advancedAdapters";

/** One paid submission or one non-paid async poll per tick, fenced by the owning job lease. */
export async function produceMedia(job:{id:string;userId:string;projectId:string;cursor:number;credits:number;leaseToken:string;plan:string;attempts?:number},signal:AbortSignal){
  const plan=productionPlanSchema.parse(JSON.parse(job.plan)),task=mediaTaskSchema.parse(plan.tasks[job.cursor]);
  const livePolicy=await getPolicy();
  const voiceTask=["TTS","CLONE","ALIGNMENT","TRANSCRIPTION"].includes(task.kind);
  const agent=await agentSettings(voiceTask?"voice":task.kind==="SFX"?"music":task.kind.toLowerCase() as "image"|"video"|"music");
  if(agent)signal=AbortSignal.any([signal,AbortSignal.timeout(agent.timeoutSeconds*1000)]);
  const allowedTool=voiceTask?"generate_voice":task.kind==="SFX"?"generate_music":`generate_${task.kind.toLowerCase()}`;
  if(agent && (!agent.allowedTools.includes(allowedTool as typeof agent.allowedTools[number])||task.credits>agent.budgetCap||job.cursor>=agent.maxSteps))throw new FactoryError("AGENT_POLICY_DENIED",403);
  const allowed=[...Object.values(livePolicy.providers),...Object.values(livePolicy.advancedProviders),...livePolicy.fallbackProviders];
  const consent=plan.configuration.voiceProfileId && voiceTask?await requireVoiceConsent(job.userId,plan.configuration.voiceProfileId,job.projectId):null;
  if(!allowed.includes(task.providerId))throw new FactoryError("PROVIDER_APPROVAL_REVOKED",403);
  await enforceUserPolicy(job.userId,0,[task.providerId],plan.configuration.durationSeconds>60);
  const existing=await prisma.videoFactoryStep.findUnique({where:{jobId_key:{jobId:job.id,key:task.key}}});
  // A persisted output is reused without submitting or billing it again.
  if(existing?.status==="COMPLETED" && existing.output){const saved=JSON.parse(existing.output) as {assetId:string};return {pending:false,plan:{...plan,assetIds:{...plan.assetIds,[task.key]:saved.assetId}}};}
  const polling=!!existing?.providerJobId;
  if(existing?.provider && !allowed.includes(existing.provider))throw new FactoryError("PROVIDER_APPROVAL_REVOKED",403);
  const provider=await getMediaProvider(existing?.provider || task.providerId,task.kind,polling?[]:plan.policy.fallbackProviders.filter(id=>allowed.includes(id)));
  // A fallback must satisfy the account policy too, not just global approval.
  await enforceUserPolicy(job.userId,0,[provider.id],plan.configuration.durationSeconds>60);
  if(agent?.modelId && ![provider.id,provider.model].includes(agent.modelId))throw new FactoryError("AGENT_MODEL_NOT_APPROVED",403);
  const effectiveFingerprint=fingerprint({task:task.fingerprint,provider:provider.id,model:polling?existing?.model:provider.model,version:polling?existing?.promptVersion:provider.version,dependency:task.kind==="ALIGNMENT"?plan.assetIds[`tts-${task.shotId}`]:task.kind==="TTS"?plan.assetIds["clone-bed"]:null});
  // Validate prerequisites before marking any new request as attempted.
  const source=task.kind==="CLONE"?await assetBytes(job.userId,consent!.sampleAssetId):task.kind==="TRANSCRIPTION"?await assetBytes(job.userId,task.prompt):task.kind==="ALIGNMENT"?await assetBytes(job.userId,plan.assetIds[`tts-${task.shotId}`]):null;
  let voice=plan.configuration.voice;
  if(task.kind==="TTS" && consent){
    if(provider.adapter!=="ELEVENLABS_TTS")throw new FactoryError("CUSTOM_VOICE_REQUIRES_ELEVENLABS",400);
    const profile=await assetBytes(job.userId,plan.assetIds["clone-bed"]),details=JSON.parse(profile.bytes.toString());
    if(details.requires_verification && !await verifyClonedVoice(provider,details.voice_id,signal))throw new FactoryError("VOICE_PROVIDER_VERIFICATION_REQUIRED",403);
    voice=details.voice_id;
  }
  if(task.kind==="TTS" && !consent && provider.adapter==="ELEVENLABS_TTS"){
    if(!provider.settings.defaultVoiceId)throw new FactoryError("PROVIDER_VOICE_NOT_CONFIGURED",503);
    voice=provider.settings.defaultVoiceId as typeof voice;
  }
  if(!rateLimit(`vf-provider:${provider.id}`,provider.settings.requestsPerMinute,60000).allowed)return {pending:true,plan};
  const active=await prisma.videoFactoryStep.count({where:{provider:provider.id,status:"SUBMITTED",completedAt:null,job:{status:{in:["RUNNING","QUEUED","PAUSED","PAUSING"]}}}});
  if(!polling && active>=provider.settings.maxConcurrent)return {pending:true,plan};
  const reused=await prisma.videoFactoryAsset.findFirst({where:{userId:job.userId,projectId:job.projectId,status:"READY",metadata:{contains:effectiveFingerprint},OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]},orderBy:{createdAt:"desc"}});
  if(reused){
    await prisma.videoFactoryStep.upsert({where:{jobId_key:{jobId:job.id,key:task.key}},create:{jobId:job.id,key:task.key,inputHash:task.fingerprint,status:"COMPLETED",output:JSON.stringify({assetId:reused.id,reused:true}),completedAt:new Date()},update:{status:"COMPLETED",output:JSON.stringify({assetId:reused.id,reused:true}),completedAt:new Date()}});
    return {pending:false,plan:{...plan,assetIds:{...plan.assetIds,[task.key]:reused.id}}};
  }
  if(existing?.status==="SUBMITTED" && !polling)throw new FactoryError("PROVIDER_OUTCOME_UNCERTAIN");
  const started=Date.now();
  if(!polling)await prisma.$transaction(async tx=>{
    const claimed=await tx.videoFactoryJob.updateMany({where:{id:job.id,leaseToken:job.leaseToken,status:"RUNNING",leaseUntil:{gt:new Date()},spentCredits:{lte:job.credits-task.credits}},data:{spentCredits:{increment:task.credits}}});
    if(!claimed.count)throw new FactoryError("BUDGET_OR_LEASE_EXCEEDED");
    await tx.videoFactoryStep.upsert({where:{jobId_key:{jobId:job.id,key:task.key}},create:{jobId:job.id,key:task.key,status:"SUBMITTED",inputHash:task.fingerprint,provider:provider.id,model:provider.model,credits:task.credits,promptVersion:provider.version},update:{status:"SUBMITTED",provider:provider.id,model:provider.model,credits:task.credits}});
  });
  try{
    if(task.kind==="VIDEO" && !polling){
      const providerJobId=await submitVideo(provider,task.prompt,plan.configuration.ratio==="9:16",signal);
      await prisma.videoFactoryStep.update({where:{jobId_key:{jobId:job.id,key:task.key}},data:{providerJobId}});
      return {pending:true,plan};
    }
    const response=task.kind==="VIDEO"?await pollVideo(provider,existing!.providerJobId!,signal):null;
    if(response && !response.ready)return {pending:true,plan};
    const result:MediaResult=response?.ready?response.result:task.kind==="IMAGE"?await generateImage(provider,task.prompt,plan.configuration.ratio,signal):task.kind==="TTS"?await generateSpeech(provider,task.prompt,voice,signal):task.kind==="CLONE"?await cloneVoice(provider,consent!.name,source!.bytes,source!.asset.mimeType,signal):task.kind==="ALIGNMENT"?await alignSpeech(provider,source!.bytes,task.prompt,source!.asset.mimeType,signal):task.kind==="TRANSCRIPTION"?await transcribeSpeech(provider,source!.bytes,source!.asset.mimeType,signal):task.kind==="SFX"?await generateSfx(provider,task.prompt,task.units,signal):await generateInstrumental(provider,task.prompt,task.units*60,signal);
    const current=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});if(current.leaseToken!==job.leaseToken || !current.leaseUntil || current.leaseUntil<new Date())throw new FactoryError("STALE_WORKER");
    const asset=await saveAsset({userId:job.userId,projectId:job.projectId,jobId:job.id,shotId:task.shotId || undefined,kind:task.kind,name:task.key,metadata:{fingerprint:effectiveFingerprint},provenance:{source:"GENERATED",provider:provider.id,model:polling?existing?.model:provider.model,version:polling?existing?.promptVersion:provider.version,prompt:task.prompt,providerJobId:result.providerJobId,commercialApproved:provider.settings.commercialApproved}},result);
    const costUsd=provider.pricing.unitUsd===null?null:provider.pricing.unitUsd*(provider.pricing.unit==="second"?task.units:provider.pricing.unit==="minute"?task.units:1);
    await prisma.videoFactoryStep.update({where:{jobId_key:{jobId:job.id,key:task.key}},data:{status:"COMPLETED",output:JSON.stringify({assetId:asset.id}),usage:JSON.stringify(result.usage || {units:task.units,unit:provider.pricing.unit}),costUsd,latencyMs:Date.now()-started,completedAt:new Date()}});
    await recordProviderHealth(provider.id,true);
    return {pending:false,plan:{...plan,assetIds:{...plan.assetIds,[task.key]:asset.id}}};
  }catch(error){
    await recordProviderHealth(provider.id,false);
    if(error instanceof ProviderFailure && error.rejected && !polling){
      await prisma.$transaction(async tx=>{const changed=await tx.videoFactoryStep.updateMany({where:{jobId:job.id,key:task.key,status:"SUBMITTED"},data:{status:"REJECTED",credits:0,completedAt:new Date()}});if(changed.count)await tx.videoFactoryJob.update({where:{id:job.id},data:{spentCredits:{decrement:task.credits}}});});
      if(error.retryable && (!agent || (job.attempts || 0)<agent.maxRetries))return {pending:true,plan,retryable:true};
    }
    throw error;
  }
}
// Keep transport consumption part of this module's audited interface for webhook/download tests.
export { boundedBytes };
export type { ProductionPlan };
