import { randomUUID } from "node:crypto";
import { open,stat } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret,decryptSecret } from "@/lib/crypto/secretBox";
import { getPolicy } from "./config";
import {enforceRole} from "./resources";
import { artifactPath } from "./render";
import { FactoryError } from "./domain";
import { boundedBytes } from "./mediaAdapters";

export const publishMetadata=z.object({title:z.string().min(1).max(100),description:z.string().max(5000),privacy:z.enum(["private","unlisted","public"]).default("private"),madeForKids:z.boolean(),tags:z.array(z.string().max(50)).max(20).default([])}).strict();
export async function savePublishingMetadata(userId:string,projectId:string,input:unknown){const metadata=publishMetadata.parse(input);const saved=await prisma.videoFactoryProject.updateMany({where:{id:projectId,userId,deletedAt:null},data:{publishing:JSON.stringify(metadata)}});if(!saved.count)throw new FactoryError("PROJECT_NOT_FOUND",404);return metadata;}
function oauthSettings(){const clientId=process.env.VIDEO_FACTORY_YOUTUBE_CLIENT_ID,clientSecret=process.env.VIDEO_FACTORY_YOUTUBE_CLIENT_SECRET,redirectUri=process.env.VIDEO_FACTORY_YOUTUBE_REDIRECT_URI;if(!clientId||!clientSecret||!redirectUri)throw new FactoryError("YOUTUBE_OAUTH_NOT_CONFIGURED",503);return {clientId,clientSecret,redirectUri};}
export function youtubeAuthorizationUrl(state:string){const {clientId,redirectUri}=oauthSettings();const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:"https://www.googleapis.com/auth/youtube.upload",access_type:"offline",prompt:"consent",state}).toString();return url.toString();}
export async function exchangeYoutubeCode(userId:string,code:string){
  const settings=oauthSettings(),response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:settings.clientId,client_secret:settings.clientSecret,redirect_uri:settings.redirectUri,grant_type:"authorization_code",code})});
  const data=JSON.parse((await boundedBytes(response,1000000)).toString()) as {refresh_token?:string;scope?:string};
  if(!response.ok||!data.refresh_token||!data.scope?.split(" ").includes("https://www.googleapis.com/auth/youtube.upload"))throw new FactoryError("YOUTUBE_AUTHORIZATION_FAILED",400);
  await prisma.$transaction(async tx=>{await tx.videoFactoryChannel.upsert({where:{userId},create:{userId,refreshToken:encryptSecret(data.refresh_token!),scope:data.scope!},update:{refreshToken:encryptSecret(data.refresh_token!),scope:data.scope!}});await tx.auditLog.create({data:{actorId:userId,action:"video_factory.youtube_connected"}});});return {connected:true};
}
async function accessToken(userId:string){const connection=await prisma.videoFactoryChannel.findUnique({where:{userId}});if(!connection)throw new FactoryError("YOUTUBE_NOT_CONNECTED",400);const settings=oauthSettings(),response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:settings.clientId,client_secret:settings.clientSecret,grant_type:"refresh_token",refresh_token:decryptSecret(connection.refreshToken)})});const data=JSON.parse((await boundedBytes(response,1000000)).toString()) as {access_token?:string};if(!response.ok||!data.access_token)throw new FactoryError("YOUTUBE_REFRESH_FAILED",400);return data.access_token;}
export async function channelState(userId:string){const channel=await prisma.videoFactoryChannel.findUnique({where:{userId},select:{scope:true,updatedAt:true}});return {configured:!!(process.env.VIDEO_FACTORY_YOUTUBE_CLIENT_ID && process.env.VIDEO_FACTORY_YOUTUBE_CLIENT_SECRET && process.env.VIDEO_FACTORY_YOUTUBE_REDIRECT_URI),connected:!!channel,scope:channel?.scope || null};}
export async function disconnectChannel(userId:string){await prisma.$transaction(async tx=>{await tx.videoFactoryChannel.deleteMany({where:{userId}});await tx.videoFactoryPublishJob.updateMany({where:{userId,status:"SCHEDULED"},data:{status:"CANCELLED"}});await tx.auditLog.create({data:{actorId:userId,action:"video_factory.youtube_disconnected"}});});return {connected:false};}
export async function schedulePublish(userId:string,projectId:string,input:unknown){
  await enforceRole("publisher","publish",0,0);
  const data=z.object({artifactId:z.string().max(100),idempotencyKey:z.string().min(8).max(100),scheduledAt:z.string().datetime(),metadata:publishMetadata,authorized:z.literal(true),rightsConfirmed:z.literal(true)}).strict().parse(input);
  if(!(await getPolicy()).publishingEnabled)throw new FactoryError("PUBLISHING_DISABLED",503);
  const when=new Date(data.scheduledAt);if(when.getTime()<Date.now()-300000||when.getTime()>Date.now()+366*86400000)throw new FactoryError("INVALID_PUBLISH_DATE",400);
  const artifact=await prisma.videoFactoryArtifact.findFirst({where:{id:data.artifactId,kind:"video",job:{userId,projectId,status:"DELIVERED"}}});if(!artifact)throw new FactoryError("ARTIFACT_NOT_FOUND",404);
  if(!(await channelState(userId)).connected)throw new FactoryError("YOUTUBE_NOT_CONNECTED",400);
  const existing=await prisma.videoFactoryPublishJob.findUnique({where:{userId_idempotencyKey:{userId,idempotencyKey:data.idempotencyKey}}});if(existing){if(existing.projectId!==projectId || existing.artifactId!==data.artifactId || existing.metadata!==JSON.stringify(data.metadata))throw new FactoryError("IDEMPOTENCY_CONFLICT");return existing;}
  return prisma.$transaction(async tx=>{const job=await tx.videoFactoryPublishJob.create({data:{id:randomUUID(),projectId,userId,artifactId:data.artifactId,idempotencyKey:data.idempotencyKey,metadata:JSON.stringify(data.metadata),scheduledAt:when,authorizedAt:new Date()}});await tx.auditLog.create({data:{actorId:userId,action:"video_factory.publish_authorized",targetId:job.id,metadata:JSON.stringify({artifactId:data.artifactId,scheduledAt:data.scheduledAt,privacy:data.metadata.privacy,rightsConfirmed:true})}});return {id:job.id,status:job.status,scheduledAt:job.scheduledAt};});
}
export async function listPublishing(userId:string,projectId:string){return prisma.videoFactoryPublishJob.findMany({where:{userId,projectId},orderBy:{createdAt:"desc"},take:30,select:{id:true,status:true,scheduledAt:true,uploadedBytes:true,providerId:true,errorCode:true,metadata:true}});}
export async function cancelPublishing(userId:string,id:string){const changed=await prisma.videoFactoryPublishJob.updateMany({where:{id,userId,status:"SCHEDULED",leaseToken:null},data:{status:"CANCELLED"}});if(!changed.count)throw new FactoryError("PUBLISH_JOB_BUSY");return {cancelled:true};}
function checkedUploadUrl(raw:string){const url=new URL(raw);if(url.origin!=="https://www.googleapis.com"||!url.pathname.startsWith("/upload/youtube/v3/videos"))throw new FactoryError("INVALID_YOUTUBE_UPLOAD_SESSION",502);return url.toString();}
/** Send one 8MiB chunk per tick. A stale chunk is reconciled with the server offset before resending. */
export async function processPublishTick(){
  if(!(await getPolicy()).publishingEnabled)return null;
  await prisma.videoFactoryPublishJob.updateMany({where:{status:"UPLOADING",leaseUntil:{lt:new Date()},uploadUrl:null,errorCode:"UPLOAD_SESSION_PENDING"},data:{status:"FAILED",leaseToken:null,leaseUntil:null,errorCode:"UPLOAD_SESSION_OUTCOME_UNCERTAIN"}});
  await prisma.videoFactoryPublishJob.updateMany({where:{status:"UPLOADING",leaseUntil:{lt:new Date()}},data:{status:"SCHEDULED",leaseToken:null,leaseUntil:null}});
  const job=await prisma.videoFactoryPublishJob.findFirst({where:{status:"SCHEDULED",scheduledAt:{lte:new Date()},leaseToken:null},orderBy:{createdAt:"asc"}});if(!job)return null;
  const lease=randomUUID(),lock=await prisma.videoFactoryPublishJob.updateMany({where:{id:job.id,status:"SCHEDULED",leaseToken:null},data:{status:"UPLOADING",leaseToken:lease,leaseUntil:new Date(Date.now()+60000)}});if(!lock.count)return null;
  try{
    await enforceRole("publisher","publish",0,0);
    const owner=await prisma.user.findUnique({where:{id:job.userId},select:{isBlocked:true}});if(!owner || owner.isBlocked)throw new FactoryError("ACCOUNT_ACCESS_REVOKED");
    const artifact=await prisma.videoFactoryArtifact.findFirst({where:{id:job.artifactId,job:{userId:job.userId,projectId:job.projectId,status:"DELIVERED"}}});if(!artifact)throw new FactoryError("ARTIFACT_NOT_FOUND",404);
    const file=artifactPath(artifact.jobId,artifact.fileName),size=(await stat(file)).size,token=await accessToken(job.userId),metadata=publishMetadata.parse(JSON.parse(job.metadata));let uploadUrl=job.uploadUrl,offset=job.uploadedBytes;
    const authorization={Authorization:`Bearer ${token}`};
    if(!uploadUrl){
      // Mark session creation as uncertain before network I/O; never duplicate an ambiguous upload insertion.
      await prisma.videoFactoryPublishJob.update({where:{id:job.id},data:{errorCode:"UPLOAD_SESSION_PENDING"}});
      const response=await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{method:"POST",redirect:"error",signal:AbortSignal.timeout(20000),headers:{...authorization,"Content-Type":"application/json","X-Upload-Content-Type":"video/mp4","X-Upload-Content-Length":String(size)},body:JSON.stringify({snippet:{title:metadata.title,description:metadata.description,tags:metadata.tags},status:{privacyStatus:metadata.privacy,selfDeclaredMadeForKids:metadata.madeForKids}})});
      if(!response.ok||!response.headers.get("location"))throw new FactoryError("YOUTUBE_SESSION_FAILED",502);
      uploadUrl=checkedUploadUrl(response.headers.get("location")!);await response.body?.cancel();await prisma.videoFactoryPublishJob.update({where:{id:job.id},data:{uploadUrl,errorCode:null}});
    }else{
      const probe=await fetch(checkedUploadUrl(uploadUrl),{method:"PUT",redirect:"error",signal:AbortSignal.timeout(15000),headers:{...authorization,"Content-Length":"0","Content-Range":`bytes */${size}`}});
      if(probe.ok){const data=JSON.parse((await boundedBytes(probe,1000000)).toString()) as {id?:string};await finishPublish(job.id,lease,data.id);return job.id;}
      if(probe.status!==308)throw new FactoryError("YOUTUBE_SESSION_EXPIRED",502);
      const last=probe.headers.get("range")?.match(/bytes=0-(\d+)/)?.[1];offset=last?Number(last)+1:0;await probe.body?.cancel();
    }
    if(offset>=size)throw new FactoryError("YOUTUBE_INVALID_OFFSET",502);
    const length=Math.min(8*1024*1024,size-offset),handle=await open(file,"r"),buffer=Buffer.alloc(length);try{await handle.read(buffer,0,length,offset);}finally{await handle.close();}
    const response=await fetch(checkedUploadUrl(uploadUrl!),{method:"PUT",redirect:"error",signal:AbortSignal.timeout(30000),headers:{...authorization,"Content-Type":"video/mp4","Content-Length":String(length),"Content-Range":`bytes ${offset}-${offset+length-1}/${size}`},body:new Uint8Array(buffer)});
    if(response.ok){const data=JSON.parse((await boundedBytes(response,1000000)).toString()) as {id?:string};await finishPublish(job.id,lease,data.id);}
    else if(response.status===308){await response.body?.cancel();await prisma.videoFactoryPublishJob.updateMany({where:{id:job.id,leaseToken:lease},data:{status:"SCHEDULED",uploadedBytes:offset+length,leaseToken:null,leaseUntil:null,errorCode:null}});}
    else throw new FactoryError("YOUTUBE_CHUNK_FAILED",502);
  }catch(error){await prisma.videoFactoryPublishJob.updateMany({where:{id:job.id,leaseToken:lease},data:{status:"FAILED",leaseToken:null,leaseUntil:null,errorCode:error instanceof FactoryError?error.code:"PUBLISH_FAILED"}});}
  return job.id;
}
async function finishPublish(id:string,lease:string,providerId?:string){if(!providerId)throw new FactoryError("INVALID_YOUTUBE_RESPONSE",502);await prisma.$transaction(async tx=>{const changed=await tx.videoFactoryPublishJob.updateMany({where:{id,leaseToken:lease},data:{status:"PUBLISHED",providerId,leaseToken:null,leaseUntil:null,errorCode:null}});if(changed.count){const job=await tx.videoFactoryPublishJob.findUniqueOrThrow({where:{id}});await tx.auditLog.create({data:{actorId:job.userId,action:"video_factory.published",targetId:id,metadata:JSON.stringify({providerId})}});}});}

