import {z} from "zod";
import {prisma} from "@/lib/db/prisma";
import {ownedAsset,saveAsset,assetBytes} from "./assets";
import {FactoryError} from "./domain";
import {jsonMedia} from "./advancedAdapters";
import {getMediaProvider} from "./registry";
import {providerRequest,ProviderFailure} from "./mediaAdapters";
import {readFile} from "node:fs/promises";
import {storagePath} from "./assets";
export const voiceConsentSchema=z.object({projectId:z.string().max(100),sampleAssetId:z.string().max(100),name:z.string().min(2).max(100),ownVoice:z.literal(true),rightsConfirmed:z.literal(true),processingConsent:z.literal(true),statement:z.string().min(20).max(2000)}).strict();
export async function createVoiceConsent(userId:string,input:unknown){
 const value=voiceConsentSchema.parse(input),sample=await ownedAsset(userId,value.sampleAssetId,value.projectId);
 if(!sample.mimeType.startsWith("audio/"))throw new FactoryError("VOICE_SAMPLE_MUST_BE_AUDIO",400);
 const consent=await saveAsset({userId,projectId:value.projectId,kind:"VOICE_CONSENT",name:value.name,provenance:{source:"USER_CONSENT",version:1,scope:"private-project-narration",recordedAt:new Date().toISOString(),...value},metadata:{sampleAssetId:sample.id}},jsonMedia(value));
 await prisma.auditLog.create({data:{actorId:userId,action:"video_factory.voice_consent_recorded",targetId:consent.id,metadata:JSON.stringify({projectId:value.projectId,sampleAssetId:sample.id})}});return {id:consent.id,name:consent.name};
}
export async function requireVoiceConsent(userId:string,id:string,projectId:string){const {asset,bytes}=await assetBytes(userId,id);if(asset.kind!=="VOICE_CONSENT"||asset.projectId!==projectId)throw new FactoryError("VOICE_CONSENT_REQUIRED",403);const consent=voiceConsentSchema.parse(JSON.parse(bytes.toString()));await ownedAsset(userId,consent.sampleAssetId,projectId);return consent;}
export async function revokeVoiceConsent(userId:string,id:string,deleteRemote=false){
 const asset=await prisma.videoFactoryAsset.findFirst({where:{id,userId,kind:"VOICE_CONSENT",status:{in:["READY","QUARANTINED"]}}});if(!asset)throw new FactoryError("VOICE_CONSENT_REQUIRED",400);
 await prisma.$transaction(async tx=>{await tx.videoFactoryAsset.update({where:{id},data:{status:"QUARANTINED"}});await tx.auditLog.create({data:{actorId:userId,action:"video_factory.voice_consent_revoked",targetId:id}});});
 let remoteDeleted=0;
 if(deleteRemote){const profiles=await prisma.videoFactoryAsset.findMany({where:{userId,projectId:asset.projectId,kind:"CLONE",status:{in:["READY","QUARANTINED"]},NOT:{metadata:{contains:'"remoteDeleted":true'}}},take:100});for(const profile of profiles){const provenance=JSON.parse(profile.provenance);if(provenance.prompt!==id)continue;const value=JSON.parse((await readFile(storagePath(profile.storageKey))).toString()),voiceId=value.voice_id;if(typeof voiceId!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(voiceId))throw new FactoryError("INVALID_VOICE_ID",400);const provider=await getMediaProvider(provenance.provider,"CLONE");await prisma.auditLog.create({data:{actorId:userId,action:"video_factory.remote_voice_delete_requested",targetId:profile.id}});try{const response=await providerRequest(provider,`/voices/${encodeURIComponent(voiceId)}`,{method:"DELETE"},AbortSignal.timeout(15000));await response.body?.cancel();}catch(error){if(!(error instanceof ProviderFailure && error.code==="PROVIDER_HTTP_404"))throw error;}await prisma.videoFactoryAsset.update({where:{id:profile.id},data:{status:"QUARANTINED",metadata:JSON.stringify({...JSON.parse(profile.metadata),remoteDeleted:true})}});remoteDeleted++;}}
 return {revoked:true,remoteDeleted};
}

