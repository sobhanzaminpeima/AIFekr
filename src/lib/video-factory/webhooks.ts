import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {prisma} from "@/lib/db/prisma";
import {FactoryError} from "./domain";
export function verifyFactoryWebhook(raw:string,headers:Headers,secret:string,now=Date.now()){
  const id=headers.get("webhook-id"),timestamp=headers.get("webhook-timestamp"),signatures=headers.get("webhook-signature");
  if(!id||id.length>200||!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!signatures||!secret)throw new FactoryError("INVALID_WEBHOOK_SIGNATURE",401);
  const key=Buffer.from(secret.startsWith("whsec_")?secret.slice(6):secret,"base64"),expected=createHmac("sha256",key).update(`${id}.${timestamp}.${raw}`).digest();
  const valid=signatures.split(" ").some(value=>{const [version,encoded]=value.split(",");if(version!=="v1"||!encoded)return false;const signature=Buffer.from(encoded,"base64");return signature.length===expected.length && timingSafeEqual(signature,expected);});
  if(!valid)throw new FactoryError("INVALID_WEBHOOK_SIGNATURE",401);return id;
}
export async function acceptFactoryWebhook(raw:string,headers:Headers,secret:string){
  const eventId=verifyFactoryWebhook(raw,headers,secret),event=z.object({type:z.string().max(100),data:z.object({id:z.string().max(150)})}).parse(JSON.parse(raw));
  if(!["video.completed","video.failed"].includes(event.type))return {accepted:true,ignored:true};
  try{return await prisma.$transaction(async tx=>{
    if(await tx.videoFactoryWebhookEvent.findUnique({where:{id:eventId}}))return {accepted:true,duplicate:true};
    await tx.videoFactoryWebhookEvent.create({data:{id:eventId,providerJobId:event.data.id}});
    const steps=await tx.videoFactoryStep.findMany({where:{providerJobId:event.data.id,status:"SUBMITTED"},select:{jobId:true}});
    await tx.videoFactoryJob.updateMany({where:{id:{in:steps.map(s=>s.jobId)},status:"QUEUED",stage:"ASSET_GENERATION"},data:{nextAttemptAt:new Date()}});
    return {accepted:true,duplicate:false};
  });}catch(error){if(await prisma.videoFactoryWebhookEvent.findUnique({where:{id:eventId}}))return {accepted:true,duplicate:true};throw error;}
}
