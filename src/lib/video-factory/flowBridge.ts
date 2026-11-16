import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { FactoryError } from "./errors";
import { saveAsset, storagePath } from "./assets";
import { claimFlowState, flowRecoveryAction, flowTaskSchema, requireFlowClaim, submitFlowState, type FlowTask } from "./flowProtocol";

const LOCK="internal-flow-worker";
const ACTIVE=["QUEUED","RUNNING"];
export function flowWorkerConfigured(){return (process.env.VIDEO_FACTORY_FLOW_WORKER_TOKEN?.length || 0)>=32;}
const parse=(raw:string|null)=>flowTaskSchema.parse(JSON.parse(raw || "{}"));
async function lock(tx:Prisma.TransactionClient){
  await tx.videoFactoryResource.upsert({where:{id:LOCK},create:{id:LOCK,kind:"INTERNAL",name:"Flow worker lock",configuration:"{}"},update:{version:{increment:1}}});
}
async function taskFor(tx:Prisma.TransactionClient,id:string,workerId:string,token:string){
  const row=await tx.videoFactoryStep.findUnique({where:{id},include:{job:true}});
  if(!row?.providerJobId?.startsWith("flow:"))throw new FactoryError("FLOW_TASK_NOT_FOUND",404);
  const task=parse(row.output);requireFlowClaim(task,workerId,token);
  return {row,task};
}

export async function enqueueFlowTask(job:{id:string;leaseToken:string},key:string,inputHash:string,provider:{id:string;model:string;version:number},task:FlowTask){
  if(!flowWorkerConfigured())throw new FactoryError("FLOW_WORKER_NOT_CONFIGURED",503);
  return prisma.$transaction(async tx=>{
    await lock(tx);
    const valid=await tx.videoFactoryJob.updateMany({where:{id:job.id,leaseToken:job.leaseToken,status:"RUNNING",leaseUntil:{gt:new Date()}},data:{updatedAt:new Date()}});
    if(!valid.count)throw new FactoryError("STALE_WORKER",409);
    const existing=await tx.videoFactoryStep.findUnique({where:{jobId_key:{jobId:job.id,key}}});
    if(existing){
      const state=parse(existing.output);
      if(state.state==="NEEDS_REVIEW")throw new FactoryError("FLOW_OUTPUT_NEEDS_REVIEW",409);
      return existing;
    }
    const owner=await tx.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});
    const unresolved=await tx.videoFactoryStep.findMany({where:{jobId:{not:job.id},key,inputHash,status:"SUBMITTED",providerJobId:{startsWith:"flow:"},job:{userId:owner.userId,projectId:owner.projectId}}});
    if(unresolved.some(step=>parse(step.output).submittedAt!==null))throw new FactoryError("FLOW_OUTPUT_NEEDS_REVIEW",409);
    return tx.videoFactoryStep.create({data:{jobId:job.id,key,inputHash,status:"SUBMITTED",provider:provider.id,model:provider.model,promptVersion:provider.version,providerJobId:`flow:${randomUUID()}`,output:JSON.stringify(task)}});
  });
}

/** A single Windows account processes one scene at a time. No automatic re-submit after START. */
export async function claimFlowTask(workerId:string){
  return prisma.$transaction(async tx=>{
    await lock(tx);
    await tx.videoFactoryResource.update({where:{id:LOCK},data:{configuration:JSON.stringify({workerId,lastSeen:Date.now()})}});
    const rows=await tx.videoFactoryStep.findMany({where:{status:"SUBMITTED",providerJobId:{startsWith:"flow:"}},include:{job:true},orderBy:{startedAt:"asc"}});
    // A submitted scene holds the account even if its parent was cancelled. Recover it first.
    const held=rows.find(row=>{const t=parse(row.output);return ["SUBMITTED","UPLOADING","NEEDS_REVIEW"].includes(t.state) || (t.state==="CLAIMED" && t.leaseUntil>Date.now());});
    const row=held || rows.find(row=>ACTIVE.includes(row.job.status) && row.job.stage==="ASSET_GENERATION");
    if(!row)return null;
    const original=parse(row.output);
    if(original.state==="UPLOADING" && (original.leaseUntil>Date.now() || original.workerId!==workerId))return null;
    const task=original.state==="UPLOADING"?original:claimFlowState(original,workerId,randomUUID(),Date.now());
    // Cancelled/paused jobs may recover already-submitted files, but never start new generation.
    if(task.state==="CLAIMED" && !ACTIVE.includes(row.job.status))return null;
    const provider=await tx.videoFactoryProvider.findUnique({where:{id:row.provider!}});
    if(task.state==="CLAIMED" && !provider?.enabled)return null;
    await tx.videoFactoryStep.update({where:{id:row.id},data:{output:JSON.stringify(task)}});
    return {id:row.id,leaseToken:task.leaseToken,action:task.state==="UPLOADING"?"RECOVER_OUTPUT":flowRecoveryAction(task),prompt:task.prompt,ratio:task.ratio,model:task.model,reference:!!task.referenceAssetId,projectId:row.job.projectId,sceneKey:row.key};
  });
}

export async function startFlowTask(id:string,workerId:string,token:string){
  return prisma.$transaction(async tx=>{
    await lock(tx);
    const {row,task}=await taskFor(tx,id,workerId,token);
    const next=submitFlowState(task,workerId,token,Date.now());
    if(!next.charge)return {submitted:true};
    const provider=await tx.videoFactoryProvider.findUnique({where:{id:row.provider!}});
    if(!provider?.enabled)throw new FactoryError("PROVIDER_APPROVAL_REVOKED",403);
    const changed=await tx.videoFactoryJob.updateMany({where:{id:row.jobId,status:{in:ACTIVE},stage:"ASSET_GENERATION",spentCredits:{lte:row.job.credits-task.credits}},data:{spentCredits:{increment:task.credits}}});
    if(!changed.count)throw new FactoryError("FLOW_JOB_NOT_ACTIVE",409);
    await tx.videoFactoryStep.update({where:{id},data:{output:JSON.stringify(next.task),credits:task.credits}});
    return {submitted:true};
  });
}

export async function flagFlowTask(id:string,workerId:string,token:string,code:string){
  return prisma.$transaction(async tx=>{
    await lock(tx);const {row,task}=await taskFor(tx,id,workerId,token);
    if(row.status==="COMPLETED")return {completed:true};
    if(task.state==="UPLOADING")throw new FactoryError("FLOW_UPLOAD_IN_PROGRESS",409);
    const submitted=task.submittedAt!==null;
    const next:FlowTask={...task,state:submitted?"NEEDS_REVIEW":"QUEUED",error:code,...(!submitted?{workerId:null,leaseToken:null,leaseUntil:0}:{})};
    await tx.videoFactoryStep.update({where:{id},data:{output:JSON.stringify(next)}});
    return {needsReview:submitted};
  });
}

/** Retry the upload, never the generation. Persisted assets bridge a crash before final acknowledgement. */
export async function completeFlowTask(id:string,workerId:string,token:string,raw:Buffer){
  const claimed=await prisma.$transaction(async tx=>{
    await lock(tx);const {row,task}=await taskFor(tx,id,workerId,token);
    if(row.status==="COMPLETED")return {row,task,done:true};
    if(!["SUBMITTED","NEEDS_REVIEW","UPLOADING"].includes(task.state))throw new FactoryError("FLOW_NOT_SUBMITTED",409);
    if(task.state==="UPLOADING" && task.leaseUntil>Date.now())throw new FactoryError("FLOW_UPLOAD_IN_PROGRESS",409);
    const next:FlowTask={...task,state:"UPLOADING",leaseUntil:Date.now()+90_000};
    await tx.videoFactoryStep.update({where:{id},data:{output:JSON.stringify(next)}});
    return {row,task:next,done:false};
  });
  if(claimed.done)return {assetId:claimed.task.assetId};
  const {row,task}=claimed;
  try{
    // Exact marker prevents output from another scene, account or project being reused.
    const marker=`"flowStepId":"${id}"`;
    let asset=await prisma.videoFactoryAsset.findFirst({where:{userId:row.job.userId,projectId:row.job.projectId,jobId:row.jobId,status:"READY",metadata:{contains:marker}},orderBy:{createdAt:"desc"}});
    if(asset){const file=await stat(storagePath(asset.storageKey));if(file.size!==asset.bytes)throw new FactoryError("SAVED_MEDIA_MISSING",409);}
    if(!asset){
      if(!raw.length || raw.length>20_000_000)throw new FactoryError("FLOW_INVALID_IMAGE",400);
      const input=sharp(raw,{limitInputPixels:40_000_000}),info=await input.metadata();
      if(!["png","jpeg","webp"].includes(info.format || "") || !info.width || !info.height)throw new FactoryError("FLOW_INVALID_IMAGE",400);
      const bytes=await input.rotate().png().toBuffer();
      if(bytes.length>20_000_000)throw new FactoryError("FLOW_INVALID_IMAGE",400);
      asset=await saveAsset({userId:row.job.userId,projectId:row.job.projectId,jobId:row.jobId,shotId:row.key.replace(/^image-/,""),kind:"IMAGE",name:row.key,
        metadata:{flowStepId:id,fingerprint:task.fingerprint,reuseFingerprint:task.reuseFingerprint},provenance:{source:"GENERATED",provider:row.provider,model:row.model,transport:"GOOGLE_FLOW",prompt:task.prompt}},
        {bytes,mimeType:"image/png",extension:"png"});
    }
    await prisma.$transaction(async tx=>{
      await lock(tx);const current=await taskFor(tx,id,workerId,token);
      if(current.row.status==="COMPLETED")return;
      if(current.task.state!=="UPLOADING" || current.task.leaseUntil!==task.leaseUntil)throw new FactoryError("FLOW_STALE_CLAIM",409);
      await tx.videoFactoryStep.update({where:{id},data:{status:"COMPLETED",output:JSON.stringify({...task,state:"COMPLETED",assetId:asset!.id,leaseUntil:0,error:null}),completedAt:new Date()}});
    });
    return {assetId:asset.id};
  }catch(error){
    await prisma.videoFactoryStep.updateMany({where:{id,status:"SUBMITTED",output:JSON.stringify(task)},data:{output:JSON.stringify({...task,state:"SUBMITTED",leaseUntil:0})}});
    throw error;
  }
}
