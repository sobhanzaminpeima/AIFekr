import {createHash} from "node:crypto";
import {publicRequestResult} from "./requestResult";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/lib/db/prisma";
import * as qwen from "@/lib/ai/qwen";
import * as openai from "@/lib/ai/openaiImage";
import * as replicate from "@/lib/ai/replicate";
import {getCreditCosts} from "@/lib/utils/creditCosts";
import {getLimitsForPlan} from "@/lib/utils/planLimits";
import {isFeatureEnabled} from "@/lib/utils/featureToggles";
import {reserveLoggedCredits,refundLoggedReservation} from "@/lib/utils/teamCredits";
import {uploadToStorage,getStorageKey} from "@/lib/storage/r2";

export const mediaInput=z.object({referenceKey:z.string().regex(/^reference_[a-zA-Z0-9_-]{8,100}$/).optional(),type:z.enum(["image","video","music"]),prompt:z.string().trim().min(1).max(6000),ratio:z.enum(["1:1","16:9","9:16"]).default("1:1"),duration:z.union([z.literal(5),z.literal(10),z.literal(30),z.literal(60),z.literal(120)]).default(5),acceptedCredits:z.number().int().nonnegative(),requestKey:z.string().regex(/^media_[a-zA-Z0-9_-]{12,100}$/)}).strict();
type Input=z.infer<typeof mediaInput>;
type Reservation={usageLogId:string;payerTeamId:string|null;mirroredAi:number};
type Payload={kind:"media";type:Input["type"];provider:string;credits:number;reservation:Reservation;predictionId?:string;recordId?:string;output?:string[];status?:string};
const hasReplicate=()=>!!process.env.REPLICATE_API_TOKEN&&process.env.REPLICATE_API_TOKEN!=="r8_your-token-here";
export async function mediaQuote(type:Input["type"],duration:number,reference=false){
 const costs=await getCreditCosts();
 const provider=type==="image"?(reference?(qwen.isQwenImageAvailable?"qwen":null):openai.isOpenAIImageAvailable?"openai":qwen.isQwenImageAvailable?"qwen":null):type==="video"?(qwen.isQwenVideoAvailable?"qwen":hasReplicate()?"replicate":null):hasReplicate()?"replicate":null;
 const credits=type==="image"?costs.image_standard:type==="video"?(duration<=5?costs.video_5s:costs.video_10s):(duration<=30?costs.music_30s:duration<=60?costs.music_60s:costs.music_120s);
 return {available:!!provider&&await isFeatureEnabled(type),provider,credits,type,duration};
}
function realMediaUrl(raw:string){try{const url=new URL(raw);return url.protocol==="https:"&&!url.username&&!url.password&&!['placehold.co','picsum.photos'].includes(url.hostname);}catch{return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw);}}
async function refund(id:string,userId:string,payload:Payload){
 await prisma.$transaction(async tx=>{const claim=await tx.mobileRequest.updateMany({where:{id,status:{in:["RUNNING","PROVIDER_PENDING"]}},data:{status:"REFUNDED"}});if(!claim.count)return;await refundLoggedReservation(tx,{...payload.reservation,userId,credits:payload.credits},{feature:`mobile.${payload.type}`,status:"REFUNDED"},payload.type);if(payload.recordId&&payload.type==="video")await tx.generatedVideo.updateMany({where:{id:payload.recordId,userId},data:{refunded:true}});if(payload.recordId&&payload.type==="music")await tx.generatedMusic.updateMany({where:{id:payload.recordId,userId},data:{refunded:true}});});
}
async function imageUrl(raw:string,userId:string){if(!realMediaUrl(raw))throw new Error("Provider returned non-production media");if(!raw.startsWith('data:'))return raw;const mime=raw.slice(5,raw.indexOf(';'));try{return await uploadToStorage(Buffer.from(raw.split(',')[1],'base64'),getStorageKey(userId,'image','native.png'),mime);}catch{return raw;}}
export async function generateMobileMedia(user:{id:string;plan:string;trialLimited:boolean},input:Input){
 if((input.type==="video"&&![5,10].includes(input.duration))||(input.type==="music"&&![30,60,120].includes(input.duration)))return {status:400,body:{error:"Unsupported duration"}};
 const hash=createHash('sha256').update(JSON.stringify({type:input.type,prompt:input.prompt,ratio:input.ratio,duration:input.duration,referenceKey:input.referenceKey})).digest('hex');
 const existing=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:input.requestKey}}});
 if(existing){if(existing.inputHash!==hash)return {status:409,body:{error:"Request key already used"}};return {status:200,body:{requestKey:input.requestKey,status:existing.status,result:publicRequestResult(existing.status,existing.responseJson)}};}
 let referenceUrl:string|undefined;
 if(input.referenceKey){if(input.type!=='image')return {status:400,body:{error:'References are supported only for images'}};const row=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:input.referenceKey}}});const asset=row?.status==='COMPLETED'&&row.responseJson?JSON.parse(row.responseJson):null;if(asset?.kind!=='reference'||typeof asset.url!=='string'||!realMediaUrl(asset.url)||asset.url.startsWith('data:'))return {status:404,body:{error:'Owned reference image not found'}};referenceUrl=asset.url;}
 const quote=await mediaQuote(input.type,input.duration,Boolean(referenceUrl));if(!quote.available||!quote.provider)return {status:503,body:{error:"Media provider is not configured or feature is disabled"}};
 if(input.acceptedCredits<quote.credits)return {status:409,body:{error:"Cost changed; review again",quote}};
 if(user.trialLimited&&input.type==="video")return {status:403,body:{error:"Video generation is not enabled for this trial"}};
 const limits=await getLimitsForPlan(user.plan);const monthlyLimit=input.type==="image"?limits.monthlyImages:input.type==="video"?limits.monthlyVideos:limits.monthlyMusics;
 let admitted;
 try{admitted=await prisma.$transaction(async tx=>{
  const monthStart=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const used=input.type==="image"?await tx.generatedImage.count({where:{userId:user.id,createdAt:{gte:monthStart}}}):input.type==="video"?await tx.generatedVideo.count({where:{userId:user.id,createdAt:{gte:monthStart}}}):await tx.generatedMusic.count({where:{userId:user.id,createdAt:{gte:monthStart}}});
  const pending=await tx.mobileRequest.findMany({where:{userId:user.id,status:"RUNNING",createdAt:{gte:monthStart}},select:{responseJson:true},take:1000});
  const inFlight=pending.filter(row=>{try{return JSON.parse(row.responseJson||'null')?.type===input.type;}catch{return false;}}).length;
  if(monthlyLimit!==-1&&used+inFlight>=monthlyLimit)throw new Error("PLAN_LIMIT");
  if(quote.provider==="openai"){
   const dayStart=new Date();dayStart.setHours(0,0,0,0);
   const daily=await tx.usageLog.count({where:{userId:user.id,type:"image",model:openai.openAIImageModel,createdAt:{gte:dayStart}}});
   const global=await tx.usageLog.count({where:{type:"image",model:openai.openAIImageModel,createdAt:{gte:monthStart}}});
   if(daily>=Number(process.env.OPENAI_IMAGE_DAILY_LIMIT_PER_USER||5)||global>=Number(process.env.OPENAI_IMAGE_MONTHLY_BUDGET_CAP||200))throw new Error("PROVIDER_BUDGET_LIMIT");
  }
  const job=await tx.mobileRequest.create({data:{userId:user.id,requestKey:input.requestKey,inputHash:hash}});
  const reservation=await reserveLoggedCredits(tx,user.id,quote.credits,{type:input.type,requestId:job.id,model:quote.provider==='openai'?openai.openAIImageModel:undefined,provider:quote.provider,mediaSeconds:input.type==='image'?1:input.duration,metadata:{feature:`mobile.${input.type}`,status:"RESERVED"}});
  if(!reservation)throw new Error("INSUFFICIENT_CREDITS");const payload:Payload={kind:"media",type:input.type,provider:quote.provider!,credits:quote.credits,reservation};
  await tx.mobileRequest.update({where:{id:job.id},data:{responseJson:JSON.stringify(payload)}});return {job,payload};
 });}catch(error){if(error instanceof Error&&['PLAN_LIMIT','PROVIDER_BUDGET_LIMIT','INSUFFICIENT_CREDITS'].includes(error.message))return {status:402,body:{error:error.message}};if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return {status:409,body:{error:'Request already submitted'}};throw error;}
 try{
  if(input.type==='image'){
   const provider=quote.provider==='openai'?openai:qwen;
   const raw=referenceUrl?await qwen.generateImageFromReference({prompt:input.prompt,style:'realistic',ratio:input.ratio,count:1,imageUrl:referenceUrl}):await provider.generateImages({prompt:input.prompt,style:'realistic',ratio:input.ratio,count:1});
   if(raw.length!==1)throw new Error('Unexpected provider result');const url=await imageUrl(raw[0],user.id);
   await prisma.$transaction(async tx=>{await tx.generatedImage.create({data:{userId:user.id,prompt:input.prompt,style:'realistic',url,sourceImageUrl:referenceUrl||null,credits:quote.credits}});await tx.mobileRequest.update({where:{id:admitted.job.id},data:{status:'COMPLETED',responseJson:JSON.stringify({...admitted.payload,output:[url],status:'succeeded'})}});await tx.usageLog.update({where:{id:admitted.payload.reservation.usageLogId},data:{metadata:JSON.stringify({feature:'mobile.image',status:'COMPLETED'})}});});
   return {status:200,body:{requestKey:input.requestKey,status:'COMPLETED',output:[url],creditsUsed:quote.credits}};
  }
  const providerResult=input.type==='video'?(quote.provider==='qwen'?await qwen.generateVideo({prompt:input.prompt,duration:input.duration as 5|10,ratio:input.ratio,style:'realistic'}):await replicate.generateVideo({prompt:input.prompt,duration:input.duration as 5|10,ratio:input.ratio,style:'realistic'})):await replicate.generateMusic({prompt:input.prompt,genre:'pop',duration:input.duration as 30|60|120});
  if(providerResult.predictionId.startsWith('dev_'))throw new Error('Provider is not configured');
  await prisma.$transaction(async tx=>{const record=input.type==='video'?await tx.generatedVideo.create({data:{userId:user.id,prompt:input.prompt,duration:input.duration,url:providerResult.predictionId,credits:quote.credits}}):await tx.generatedMusic.create({data:{userId:user.id,prompt:input.prompt,duration:input.duration,url:providerResult.predictionId,credits:quote.credits}});await tx.mobileRequest.update({where:{id:admitted.job.id},data:{status:'PROVIDER_PENDING',responseJson:JSON.stringify({...admitted.payload,predictionId:providerResult.predictionId,recordId:record.id})}});});
  return {status:202,body:{requestKey:input.requestKey,status:'PROVIDER_PENDING',creditsUsed:quote.credits}};
 }catch{
  await refund(admitted.job.id,user.id,admitted.payload);
  return {status:502,body:{error:'Media generation failed; reserved credits refunded',status:'REFUNDED',requestKey:input.requestKey}};
 }
}
export async function mobileMediaStatus(userId:string,requestKey:string){
 const row=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId,requestKey}}});if(!row)return {status:404,body:{error:'Not found'}};
 const payload:Payload=JSON.parse(row.responseJson||'null');if(payload?.kind!=='media')return {status:404,body:{error:'Not found'}};
 if(row.status!=='PROVIDER_PENDING'||!payload.predictionId)return {status:200,body:{requestKey,status:row.status,output:row.status==='COMPLETED'?payload.output:undefined,creditsUsed:payload.credits}};
 if((payload.provider==='replicate'&&!hasReplicate())||(payload.provider==='qwen'&&!qwen.isQwenVideoAvailable))return {status:503,body:{error:'Provider status temporarily unavailable'}};
 const state=payload.provider==='qwen'?await qwen.getQwenTaskStatus(payload.predictionId.replace(/^qwen:/,'')):await replicate.getPredictionStatus(payload.predictionId);
 if(typeof state.error==='string'&&state.error.startsWith('HTTP '))return {status:503,body:{error:'Provider status temporarily unavailable'}};
 if(['failed','canceled'].includes(state.status)){await refund(row.id,userId,payload);return persistedMediaStatus(userId,requestKey);}
 if(state.status==='succeeded'){
  const output=Array.isArray(state.output)?state.output[0]:state.output;if(typeof output!=='string'||!realMediaUrl(output)||output.startsWith('data:'))return {status:503,body:{error:'Provider did not return valid media'}};
  await prisma.$transaction(async tx=>{const claimed=await tx.mobileRequest.updateMany({where:{id:row.id,status:'PROVIDER_PENDING'},data:{status:'COMPLETED',responseJson:JSON.stringify({...payload,output:[output],status:'succeeded'})}});if(!claimed.count)return;if(payload.type==='video')await tx.generatedVideo.updateMany({where:{id:payload.recordId,userId},data:{url:output}});else await tx.generatedMusic.updateMany({where:{id:payload.recordId,userId},data:{url:output}});await tx.usageLog.update({where:{id:payload.reservation.usageLogId},data:{metadata:JSON.stringify({feature:`mobile.${payload.type}`,status:'COMPLETED'})}});});
  return persistedMediaStatus(userId,requestKey);
 }
 return {status:200,body:{requestKey,status:'PROVIDER_PENDING',providerStatus:state.status,creditsUsed:payload.credits}};
}

async function persistedMediaStatus(userId:string,requestKey:string){
 const current=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId,requestKey}}});
 if(!current)return {status:404,body:{error:'Not found'}};
 const payload:Payload=JSON.parse(current.responseJson||'null');
 return {status:200,body:{requestKey,status:current.status,output:current.status==='COMPLETED'?payload?.output:undefined,creditsUsed:payload?.credits}};
}


