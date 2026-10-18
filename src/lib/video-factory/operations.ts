import { prisma } from "@/lib/db/prisma";
import { FactoryError } from "./domain";
import { controlJob,settleJob } from "./service";
import { listResources,alertConfig } from "./resources";
import { publicProvider } from "./registry";
import { removeAsset } from "./assets";
import {privateRoot} from "./assets";
import {artifactDirectory} from "./render";
import {rm} from "node:fs/promises";
import path from "node:path";
import {getPolicy} from "./config";

export async function inspectJob(actorId:string,id:string){
  const job=await prisma.videoFactoryJob.findUnique({where:{id},include:{project:{select:{title:true,userId:true,configuration:true,manifest:true,research:true,publishing:true}},steps:{orderBy:{startedAt:"asc"}},artifacts:true}});
  if(!job)throw new FactoryError("JOB_NOT_FOUND",404);
  const [approvals,quality]=await Promise.all([prisma.videoFactoryApproval.findMany({where:{jobId:id},orderBy:{createdAt:"desc"}}),prisma.videoFactoryQualityReport.findMany({where:{jobId:id},orderBy:{createdAt:"desc"}})]);
  await prisma.auditLog.create({data:{actorId,action:"video_factory.job_inspected",targetId:id}});
  return {job,approvals,quality};
}
export async function changePriority(actorId:string,id:string,priority:number){
  if(!Number.isInteger(priority)||priority< -10||priority>10)throw new FactoryError("INVALID_PRIORITY",400);
  await prisma.$transaction(async tx=>{const changed=await tx.videoFactoryJob.updateMany({where:{id,status:"QUEUED"},data:{priority}});if(!changed.count)throw new FactoryError("JOB_NOT_QUEUED");await tx.auditLog.create({data:{actorId,action:"video_factory.priority_changed",targetId:id,metadata:JSON.stringify({priority})}});});return {saved:true};
}
export async function requeueJob(actorId:string,id:string){
  const job=await prisma.videoFactoryJob.findUnique({where:{id}});if(!job)throw new FactoryError("JOB_NOT_FOUND",404);
  if(job.settledAt)throw new FactoryError("NEW_BUDGET_AUTHORIZATION_REQUIRED",409);
  if(job.status==="PAUSED")return controlJob(actorId,job.projectId,"resume",true);
  if(job.status!=="QUEUED")throw new FactoryError("JOB_NOT_QUEUED");
  await prisma.$transaction(async tx=>{await tx.videoFactoryJob.updateMany({where:{id,status:"QUEUED"},data:{nextAttemptAt:null}});await tx.auditLog.create({data:{actorId,action:"video_factory.requeued",targetId:id}});});return {id,status:"QUEUED"};
}
export async function bulkControl(actorId:string,projectIds:string[],action:"pause"|"resume"|"cancel"){
  if(projectIds.length<1||projectIds.length>20)throw new FactoryError("BULK_LIMIT",400);
  const results=[];for(const id of [...new Set(projectIds)]){try{results.push({projectId:id,result:await controlJob(actorId,id,action,true)});}catch(e){results.push({projectId:id,error:e instanceof FactoryError?e.code:"OPERATION_FAILED"});}}return results;
}
export async function quarantineAsset(actorId:string,id:string,reason:string){
  await prisma.$transaction(async tx=>{const asset=await tx.videoFactoryAsset.findUniqueOrThrow({where:{id}});await tx.videoFactoryAsset.update({where:{id},data:{status:"QUARANTINED"}});await tx.auditLog.create({data:{actorId,action:"video_factory.asset_quarantined",targetId:id,metadata:JSON.stringify({reason:reason.slice(0,1000),userId:asset.userId})}});});return {quarantined:true};
}
export async function retentionSweep(actorId:string){
  const stale=await prisma.videoFactoryAsset.findMany({where:{status:{in:["READY","QUARANTINED"]},expiresAt:{lt:new Date()}},take:100,select:{id:true}});let deleted=0;
  for(const asset of stale){try{await removeAsset(actorId,asset.id,true);deleted++;}catch(error){if(!(error instanceof FactoryError))throw error;}}
  const policy=await getPolicy(),expired=await prisma.videoFactoryJob.findMany({where:{settledAt:{lt:new Date(Date.now()-policy.retentionDays*86400000)},storageBytes:{gt:0}},take:30});let purgedJobs=0;
  for(const job of expired){const root=path.resolve(privateRoot()),target=path.resolve(artifactDirectory(job.id));if(!target.startsWith(root+path.sep))throw new FactoryError("INVALID_RETENTION_PATH",500);
    if(await prisma.videoFactoryPublishJob.count({where:{artifactId:{in:(await prisma.videoFactoryArtifact.findMany({where:{jobId:job.id},select:{id:true}})).map(a=>a.id)},status:{in:["SCHEDULED","UPLOADING"]}}}))continue;
    await rm(target,{recursive:true,force:true});
    await prisma.$transaction(async tx=>{const current=await tx.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});const changed=await tx.videoFactoryJob.updateMany({where:{id:job.id,storageBytes:current.storageBytes},data:{storageBytes:0}});if(changed.count){await tx.videoFactoryStorageQuota.updateMany({where:{userId:job.userId},data:{usedBytes:{decrement:current.storageBytes}}});await tx.videoFactoryArtifact.deleteMany({where:{jobId:job.id}});await tx.auditLog.create({data:{actorId,action:"video_factory.expired_render_purged",targetId:job.id}});}});purgedJobs++;
  }
  return {examined:stale.length,deleted,purgedJobs};
}
export async function expireHolds(){
  const cutoff=new Date(Date.now()-72*3600000),jobs=await prisma.videoFactoryJob.findMany({where:{settledAt:null,createdAt:{lt:cutoff},status:{in:["QUEUED","PAUSED","AWAITING_APPROVAL"]}},take:50});
  for(const job of jobs)await prisma.$transaction(tx=>settleJob(tx,job.id,"FAILED","AUTHORIZATION_HOLD_EXPIRED"));return jobs.length;
}
export async function adminAnalytics(){
  const since=new Date(Date.now()-30*86400000);
  const [jobs,providers,resources,assets,quality,users,audit,storage,errors,publish]=await Promise.all([
    prisma.videoFactoryJob.findMany({where:{createdAt:{gte:since}},orderBy:{createdAt:"desc"},take:1000,select:{id:true,status:true,stage:true,createdAt:true,updatedAt:true,settledAt:true,credits:true,spentCredits:true,actualCostUsd:true,userId:true,errorCode:true}}),
    prisma.videoFactoryProvider.findMany({orderBy:{name:"asc"}}),listResources(),
    prisma.videoFactoryAsset.findMany({take:100,orderBy:{createdAt:"desc"},select:{id:true,userId:true,projectId:true,name:true,kind:true,status:true,bytes:true,expiresAt:true,provenance:true}}),
    prisma.videoFactoryQualityReport.groupBy({by:["kind","status"],_count:true}),
    prisma.user.findMany({where:{id:{in:(await prisma.videoFactoryProject.findMany({distinct:["userId"],select:{userId:true},take:100})).map(p=>p.userId)}},select:{id:true,name:true,plan:true,role:true,isBlocked:true,credits:true}}),
    prisma.auditLog.findMany({where:{action:{startsWith:"video_factory."}},take:100,orderBy:{createdAt:"desc"}}),
    prisma.videoFactoryStorageQuota.aggregate({_sum:{usedBytes:true}}),
    prisma.videoFactoryJob.groupBy({by:["errorCode"],where:{errorCode:{not:null}},_count:true}),
    prisma.videoFactoryPublishJob.findMany({take:50,orderBy:{createdAt:"desc"},select:{id:true,projectId:true,status:true,scheduledAt:true,uploadedBytes:true,providerId:true,errorCode:true}}),
  ]);
  const rules=resources.filter(r=>r.kind==="ALERT" && r.enabled),alerts=rules.flatMap(rule=>{
    const config=alertConfig.parse(rule.configuration),window=new Date(Date.now()-config.windowHours*3600000);
    const value=config.metric==="QUEUED_JOBS"?jobs.filter(j=>j.status==="QUEUED").length:config.metric==="FAILED_JOBS"?jobs.filter(j=>j.status==="FAILED" && j.createdAt>=window).length:config.metric==="UNCERTAIN_REQUESTS"?jobs.filter(j=>j.errorCode==="PROVIDER_OUTCOME_UNCERTAIN" && j.createdAt>=window).length:storage._sum.usedBytes || 0;
    return value>=config.threshold?[{id:rule.id,name:rule.name,metric:config.metric,value,threshold:config.threshold}]:[];
  });
  const finished=jobs.filter(j=>j.status==="DELIVERED" && j.settledAt),measured=jobs.filter(j=>j.actualCostUsd!==null);
  return {windowDays:30,limitedTo:1000,summary:{totalJobs:jobs.length,queued:jobs.filter(j=>j.status==="QUEUED").length,running:jobs.filter(j=>j.status==="RUNNING").length,delivered:finished.length,failed:jobs.filter(j=>j.status==="FAILED").length,spentCredits:jobs.reduce((n,j)=>n+j.spentCredits,0),heldCredits:jobs.filter(j=>!j.settledAt).reduce((n,j)=>n+j.credits-j.spentCredits,0),measuredProviderCostUsd:measured.length?measured.reduce((n,j)=>n+(j.actualCostUsd || 0),0):null,costCoverage:jobs.length?measured.length/jobs.length:null,averageJobSeconds:finished.length?finished.reduce((n,j)=>n+(j.settledAt!.getTime()-j.createdAt.getTime())/1000,0)/finished.length:null,storageBytes:storage._sum.usedBytes || 0},providers:providers.map(publicProvider),resources,assets,quality,users,audit,errors,publish,alerts};
}

