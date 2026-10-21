import {readFile,rm} from "node:fs/promises";
import path from "node:path";
import {prisma} from "@/lib/db/prisma";
import {getPolicy} from "./config";
import {getMediaProvider} from "./registry";
import {agentSettings,enforceUserPolicy} from "./resources";
import {artifactDirectory,mediaCommand} from "./render";
import {inspectFrames,semanticSchema} from "./advancedAdapters";
import {ProviderFailure} from "./mediaAdapters";
import {FactoryError,timeline,type Configuration,type Manifest,type Policy} from "./domain";
import {fingerprint} from "./production";
export async function reviewSemanticShot(job:{id:string;userId:string;projectId:string;cursor:number;leaseToken:string;credits:number},manifest:Manifest,configuration:Configuration,policy:Policy,sources:unknown,signal:AbortSignal){
 const key=`semantic-${job.cursor}`,live=await getPolicy();
 if(!live.advancedProviders.vision || live.advancedProviders.vision!==policy.advancedProviders.vision)throw new FactoryError("PROVIDER_APPROVAL_REVOKED",403);
 const provider=await getMediaProvider(policy.advancedProviders.vision,"VISION"),agent=await agentSettings("critic"),credits=policy.creditsPerSemanticReview!;
 await enforceUserPolicy(job.userId,0,[provider.id],configuration.durationSeconds>60);
 if(agent && (!agent.allowedTools.includes("qc")||credits>agent.budgetCap||job.cursor>=agent.maxSteps||(agent.modelId && ![provider.id,provider.model].includes(agent.modelId))))throw new FactoryError("AGENT_POLICY_DENIED",403);
 const existing=await prisma.videoFactoryStep.findUnique({where:{jobId_key:{jobId:job.id,key}}});
 if(existing?.status==="COMPLETED")return semanticSchema.parse(JSON.parse(existing.output!));
 if(existing?.status==="SUBMITTED")throw new FactoryError("PROVIDER_OUTCOME_UNCERTAIN");
 const shot=timeline(manifest,configuration.durationSeconds).shots[job.cursor],dir=artifactDirectory(job.id),frames:Buffer[]=[];
 for(let i=0;i<3;i++){const file=path.join(dir,`qc-${job.cursor}-${i}.jpg`);try{await mediaCommand("ffmpeg",["-y","-ss",String((i+.5)/3*shot.durationFrames/24),"-i",path.join(dir,`shot-${job.cursor}.mp4`),"-frames:v","1","-vf","scale=512:-2",file],signal);frames.push(await readFile(file));}finally{await rm(file,{force:true});}}
 await prisma.$transaction(async tx=>{const changed=await tx.videoFactoryJob.updateMany({where:{id:job.id,leaseToken:job.leaseToken,status:"RUNNING",leaseUntil:{gt:new Date()},spentCredits:{lte:job.credits-credits}},data:{spentCredits:{increment:credits}}});if(!changed.count)throw new FactoryError("BUDGET_OR_LEASE_EXCEEDED");await tx.videoFactoryStep.upsert({where:{jobId_key:{jobId:job.id,key}},create:{jobId:job.id,key,status:"SUBMITTED",credits,provider:provider.id,model:provider.model,inputHash:fingerprint({shot,style:configuration.styleBible,sources}),promptVersion:provider.version},update:{status:"SUBMITTED",credits}});});
 try{
 const result=await inspectFrames(provider,frames,{shot,characters:manifest.characters,style:configuration.styleBible,sources,reviewInstructions:agent?.systemPrompt},agent?AbortSignal.any([signal,AbortSignal.timeout(agent.timeoutSeconds*1000)]):signal),review=semanticSchema.parse(JSON.parse(result.bytes.toString()));
 await prisma.$transaction(async tx=>{const lock=await tx.videoFactoryJob.updateMany({where:{id:job.id,leaseToken:job.leaseToken,leaseUntil:{gt:new Date()}},data:{errorCode:null}});if(!lock.count)throw new FactoryError("STALE_WORKER");await tx.videoFactoryStep.update({where:{jobId_key:{jobId:job.id,key}},data:{status:"COMPLETED",output:JSON.stringify(review),usage:JSON.stringify(result.usage || null),costUsd:provider.pricing.unit==="request"?provider.pricing.unitUsd:null,completedAt:new Date()}});await tx.videoFactoryQualityReport.create({data:{jobId:job.id,shotId:shot.id,kind:"SEMANTIC",status:review.findings.some(f=>f.severity==="ERROR")?"FAILED":review.findings.length?"WARNING":"PASSED",findings:JSON.stringify(review)}});});return review;
 }catch(error){if(error instanceof ProviderFailure && error.rejected)await prisma.$transaction(async tx=>{const changed=await tx.videoFactoryStep.updateMany({where:{jobId:job.id,key,status:"SUBMITTED"},data:{status:"REJECTED",credits:0,completedAt:new Date()}});if(changed.count)await tx.videoFactoryJob.update({where:{id:job.id},data:{spentCredits:{decrement:credits}}});});throw error;}
}
