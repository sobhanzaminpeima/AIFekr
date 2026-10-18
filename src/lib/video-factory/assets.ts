import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rm, stat,readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { prisma } from "@/lib/db/prisma";
import { getPolicy } from "./config";
import { FactoryError } from "./domain";
import { artifactDirectory, mediaCommand } from "./render";
import type { MediaResult } from "./mediaAdapters";

export function privateRoot(){return path.dirname(artifactDirectory("root"));}
export function storagePath(key:string){
  if(!/^(?:assets\/[a-zA-Z0-9-]+\.(?:png|jpg|mp3|mp4|wav|json)|[a-zA-Z0-9-]+\/(?:shot-\d+\.mp4|remotion-\d+\.(?:mp4|json)|plate-\d+\.png|film\.mp4|thumbnail\.png|captions\.(?:srt|vtt)|manifest\.json|transcript\.txt|chapters\.txt|project\.zip))$/.test(key))throw new FactoryError("INVALID_STORAGE_KEY",400);
  return path.join(privateRoot(),...key.split("/"));
}
export async function ownedAsset(userId:string,id:string,projectId?:string){
  const asset=await prisma.videoFactoryAsset.findFirst({where:{id,userId,status:"READY",...(projectId?{projectId}:{}),OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});
  if(!asset)throw new FactoryError("ASSET_NOT_FOUND",404);return asset;
}
export async function saveAsset(input:{userId:string;projectId:string;jobId?:string;shotId?:string;kind:string;name:string;provenance:Record<string,unknown>;metadata?:unknown},media:MediaResult){
  const policy=await getPolicy(),id=randomUUID(),storageKey=`assets/${id}.${media.extension}`,file=storagePath(storageKey);
  await mkdir(path.dirname(file),{recursive:true});
  try{
    // Reserve private disk capacity atomically before creating a persistent file.
    await prisma.$transaction(async tx=>{
      await tx.videoFactoryStorageQuota.upsert({where:{userId:input.userId},create:{userId:input.userId},update:{}});
      const reserved=await tx.videoFactoryStorageQuota.updateMany({where:{userId:input.userId,usedBytes:{lte:policy.maxStorageBytesPerUser-media.bytes.length}},data:{usedBytes:{increment:media.bytes.length}}});
      if(!reserved.count)throw new FactoryError("STORAGE_QUOTA_EXCEEDED",413);
      await tx.videoFactoryAsset.create({data:{id,userId:input.userId,projectId:input.projectId,jobId:input.jobId,shotId:input.shotId,kind:input.kind,name:input.name,storageKey,mimeType:media.mimeType,bytes:media.bytes.length,sha256:createHash("sha256").update(media.bytes).digest("hex"),provenance:JSON.stringify(input.provenance),metadata:JSON.stringify(input.metadata || {}),status:"WRITING",expiresAt:new Date(Date.now()+policy.retentionDays*86400000)}});
    });
    await writeFile(file,media.bytes,{flag:"wx"});
    return await prisma.videoFactoryAsset.update({where:{id},data:{status:"READY"}});
  }catch(error){
    await prisma.$transaction(async tx=>{const asset=await tx.videoFactoryAsset.findUnique({where:{id}});if(asset?.status==="WRITING"){await tx.videoFactoryAsset.update({where:{id},data:{status:"DELETED"}});await tx.videoFactoryStorageQuota.update({where:{userId:input.userId},data:{usedBytes:{decrement:asset.bytes}}});}});
    await rm(file,{force:true});throw error;
  }
}
export async function listAssets(userId:string,projectId?:string,search="",page=0){
  return prisma.videoFactoryAsset.findMany({where:{userId,status:"READY",...(projectId?{projectId}:{}),...(search?{name:{contains:search}}:{})},orderBy:{createdAt:"desc"},take:40,skip:page*40,select:{id:true,projectId:true,kind:true,name:true,mimeType:true,bytes:true,createdAt:true,expiresAt:true,shotId:true,provenance:true,metadata:true}});
}
export async function removeAsset(actorId:string,id:string,admin=false){
  const row=await prisma.videoFactoryAsset.findFirst({where:{id,...(admin?{}:{userId:actorId}),status:{in:["READY","QUARANTINED"]}}});
  if(!row)throw new FactoryError("ASSET_NOT_FOUND",404);
  if(await prisma.videoFactoryJob.count({where:{projectId:row.projectId,status:{in:["RUNNING","QUEUED","PAUSED","PAUSING","CANCELLING","AWAITING_APPROVAL"]}}}))throw new FactoryError("PROJECT_BUSY");
  await prisma.$transaction(async tx=>{const changed=await tx.videoFactoryAsset.updateMany({where:{id,status:{in:["READY","QUARANTINED"]}},data:{status:"DELETED"}});if(changed.count)await tx.videoFactoryStorageQuota.update({where:{userId:row.userId},data:{usedBytes:{decrement:row.bytes}}});await tx.auditLog.create({data:{actorId,action:"video_factory.asset_deleted",targetId:id,metadata:JSON.stringify({admin})}});});
  await rm(storagePath(row.storageKey),{force:true});return {deleted:true};
}
async function scan(file:string){
  const clam=process.env.VIDEO_FACTORY_CLAMSCAN,binary=clam || process.env.VIDEO_FACTORY_DEFENDER;
  if(!binary)throw new FactoryError("UPLOAD_SCANNER_NOT_CONFIGURED",503);
  await new Promise<void>((resolve,reject)=>{const child=spawn(binary,clam?["--no-summary",file]:["-Scan","-ScanType","3","-File",file,"-DisableRemediation"],{shell:false,windowsHide:true,stdio:"ignore",signal:AbortSignal.timeout(30000)});child.once("error",()=>reject(new FactoryError("UPLOAD_SCANNER_UNAVAILABLE",503)));child.once("close",code=>code===0?resolve():reject(new FactoryError("UPLOAD_REJECTED",400)));});
  return clam?"CLAMAV":"WINDOWS_DEFENDER";
}
export async function uploadAsset(userId:string,projectId:string,bytes:Buffer,contentType:string,name:string,rightsConfirmed:boolean){
  if(!rightsConfirmed)throw new FactoryError("RIGHTS_CONFIRMATION_REQUIRED",400);
  const project=await prisma.videoFactoryProject.findFirst({where:{id:projectId,userId,deletedAt:null}});if(!project)throw new FactoryError("PROJECT_NOT_FOUND",404);
  if(bytes.length>50000000)throw new FactoryError("UPLOAD_TOO_LARGE",413);
  const id=randomUUID(),temp=path.join(privateRoot(),`scan-${id}`);await mkdir(privateRoot(),{recursive:true});await writeFile(temp,bytes,{flag:"wx"});
  try{
    const scanner=await scan(temp);
    let result:MediaResult,kind:string,metadata:unknown;
    if(["image/png","image/jpeg","image/webp"].includes(contentType)){
      const image=sharp(bytes,{limitInputPixels:40000000});const info=await image.metadata();if(!["png","jpeg","webp"].includes(info.format || ""))throw new FactoryError("MEDIA_TYPE_MISMATCH",400);
      result={bytes:await image.rotate().resize({width:3840,height:3840,fit:"inside",withoutEnlargement:true}).png().toBuffer(),extension:"png",mimeType:"image/png"};kind="IMAGE";metadata={width:info.width,height:info.height};
    }else if(["video/mp4","audio/mpeg","audio/wav"].includes(contentType)){
      const info=JSON.parse(await mediaCommand("ffprobe",["-v","error","-protocol_whitelist","file","-show_entries","format=duration,format_name:stream=codec_type,width,height","-of","json",temp]));
      if(!Number.isFinite(Number(info.format?.duration)) || Number(info.format.duration)>3600)throw new FactoryError("INVALID_MEDIA_DURATION",400);
      const video=contentType==="video/mp4";
      if(!info.streams?.some((s:{codec_type:string})=>s.codec_type===(video?"video":"audio")))throw new FactoryError("MEDIA_TYPE_MISMATCH",400);
      const detected=String(info.format?.format_name || "");if(video?!/mp4|mov/.test(detected):contentType==="audio/mpeg"?!/mp3/.test(detected):!/wav/.test(detected))throw new FactoryError("MEDIA_TYPE_MISMATCH",400);
      result={bytes,extension:video?"mp4":contentType==="audio/mpeg"?"mp3":"wav",mimeType:contentType};kind=video?"VIDEO":"AUDIO";metadata=info;
    }else throw new FactoryError("UNSUPPORTED_MEDIA_TYPE",400);
    return await saveAsset({userId,projectId,kind,name:name.slice(0,180),metadata,provenance:{source:"USER_UPLOAD",rightsConfirmed:true,scanner,uploadedAt:new Date().toISOString()}},result);
  }finally{await rm(temp,{force:true});}
}
export async function assetBytes(userId:string,id:string){const asset=await ownedAsset(userId,id);return {asset,bytes:await readFile(storagePath(asset.storageKey))};}
export async function verifyAssetFile(id:string){const asset=await prisma.videoFactoryAsset.findUniqueOrThrow({where:{id}});return (await stat(storagePath(asset.storageKey))).size===asset.bytes;}
export async function accountJobStorage(jobId:string,userId:string,limit:number){
  const directory=artifactDirectory(jobId);let total=0;
  for(const name of await readdir(directory)){if(/^(?:shot-\d+\.mp4|remotion-\d+\.(?:mp4|json)|plate-\d+\.png|film\.mp4|thumbnail\.png|captions\.(?:srt|vtt)|manifest\.json|transcript\.txt|chapters\.txt|project\.zip|(?:narration|music|layers)\.m4a|captions-shot-\d+\.ass|concat\.txt)$/.test(name))total+=(await stat(path.join(directory,name))).size;}
  await prisma.$transaction(async tx=>{const job=await tx.videoFactoryJob.findUniqueOrThrow({where:{id:jobId}}),difference=total-job.storageBytes;
    await tx.videoFactoryStorageQuota.upsert({where:{userId},create:{userId},update:{}});
    const reserved=await tx.videoFactoryStorageQuota.updateMany({where:{userId,usedBytes:{lte:limit-difference}},data:{usedBytes:{increment:difference}}});if(!reserved.count)throw new FactoryError("STORAGE_QUOTA_EXCEEDED",413);
    await tx.videoFactoryJob.update({where:{id:jobId},data:{storageBytes:total}});
  });
  return total;
}



