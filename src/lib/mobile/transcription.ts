import {createHash} from "node:crypto";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db/prisma";
import {PROVIDERS} from "@/lib/ai/providers";
import {getCreditCosts} from "@/lib/utils/creditCosts";
import {toolCostKey} from "@/lib/utils/credits";
import {reserveLoggedCredits,refundLoggedReservation} from "@/lib/utils/teamCredits";

export const TRANSCRIPTION_MAX_BYTES=25*1024*1024;
const audioTypes=new Set(["audio/mpeg","audio/mp4","audio/mp4a-latm","audio/wav","audio/x-wav","audio/webm","audio/ogg","audio/flac"]);
export function validAudio(file:{type:string;size:number}){return audioTypes.has(file.type)&&file.size>0&&file.size<=TRANSCRIPTION_MAX_BYTES;}
export async function transcriptionQuote(){const costs=await getCreditCosts();const provider=PROVIDERS.find(p=>p.id==="openai-direct");return {credits:costs[toolCostKey("mobile.transcribe")]??costs.tool,available:!!provider?.apiKey&&provider.apiKey.length>=10,maxBytes:TRANSCRIPTION_MAX_BYTES};}
export async function transcribeMobile(userId:string,file:File,requestKey:string,acceptedCredits:number,locale:string){
 const quote=await transcriptionQuote();if(!quote.available)return {status:503,body:{error:"Transcription provider is not configured"}};
 if(acceptedCredits<quote.credits)return {status:409,body:{error:"Cost changed; review the estimate",quote}};
 const bytes=Buffer.from(await file.arrayBuffer());const inputHash=createHash("sha256").update(bytes).update(locale).digest("hex");
 const existing=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId,requestKey}}});
 if(existing){if(existing.inputHash!==inputHash)return {status:409,body:{error:"Request key already used"}};if(existing.status==="COMPLETED"&&existing.responseJson)return {status:200,body:JSON.parse(existing.responseJson)};return {status:409,body:{error:"Already submitted; do not resubmit",status:existing.status}};}
 let admitted;
 try{admitted=await prisma.$transaction(async tx=>{
  const job=await tx.mobileRequest.create({data:{userId,requestKey,inputHash}});
  const reservation=await reserveLoggedCredits(tx,userId,quote.credits,{type:"tool",requestId:job.id,metadata:{feature:"mobile.transcribe",status:"RESERVED"}});
  if(!reservation)throw new Error("INSUFFICIENT_CREDITS");
  await tx.mobileRequest.update({where:{id:job.id},data:{responseJson:JSON.stringify({reservation,credits:quote.credits})}});
  return {job,reservation};
 });}catch(error){if(error instanceof Error&&error.message==="INSUFFICIENT_CREDITS")return {status:402,body:{error:"Not enough credits"}};if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")return {status:409,body:{error:"Request already in progress"}};throw error;}
 let text:string;
 try{
  const provider=PROVIDERS.find(p=>p.id==="openai-direct")!;const body=new FormData();body.set("file",new File([bytes],file.name,{type:file.type}));body.set("model",process.env.OPENAI_TRANSCRIPTION_MODEL||"gpt-4o-mini-transcribe");body.set("response_format","json");if(["fa","en","tr"].includes(locale))body.set("language",locale);
  const response=await fetch(`${provider.baseURL}/audio/transcriptions`,{method:"POST",body,headers:{Authorization:`Bearer ${provider.apiKey}`},signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error("TRANSCRIPTION_FAILED");const result=await response.json();if(typeof result.text!=="string"||!result.text.trim())throw new Error("TRANSCRIPTION_EMPTY");text=result.text.trim().slice(0,100000);
 }catch{
  await prisma.$transaction(async tx=>{const claim=await tx.mobileRequest.updateMany({where:{id:admitted.job.id,status:"RUNNING"},data:{status:"REFUNDED"}});if(claim.count)await refundLoggedReservation(tx,{...admitted.reservation,userId,credits:quote.credits},{feature:"mobile.transcribe",requestKey},"tool");});
  return {status:502,body:{error:"Transcription failed; reserved credits refunded",status:"REFUNDED"}};
 }
 const result={text,creditsUsed:quote.credits};
 // A persistence error after provider success is not retried or silently refunded.
 await prisma.$transaction(async tx=>{await tx.mobileRequest.update({where:{id:admitted.job.id},data:{status:"COMPLETED",responseJson:JSON.stringify(result)}});await tx.usageLog.update({where:{id:admitted.reservation.usageLogId},data:{metadata:JSON.stringify({feature:"mobile.transcribe",status:"COMPLETED",requestKey})}});});
 return {status:200,body:result};
}
