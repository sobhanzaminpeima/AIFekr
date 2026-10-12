import {z} from "zod";
import {prisma} from "@/lib/db/prisma";
import {encryptSecret,decryptSecret} from "@/lib/crypto/secretBox";
import {ratio} from "./money";
export const XE_CONFIG_KEY="billing_xe_config",XE_HEALTH_KEY="billing_xe_health";
const configSchema=z.object({enabled:z.boolean(),apiKey:z.string().max(500),accountId:z.string().max(100).default(""),authMode:z.enum(["BEARER","BASIC"]).default("BEARER")}).strict();
type Config=z.infer<typeof configSchema>;
const responseSchema=z.object({from:z.literal("USD"),amount:z.literal(1),timestamp:z.string().datetime(),to:z.array(z.object({quotecurrency:z.enum(["TRY","EUR"]),mid:z.number().positive().finite()})).length(2)});
export function validateXeRates(raw:unknown,now=new Date()){
 const data=responseSchema.parse(raw),observed=new Date(data.timestamp);
 if(observed.getTime()>now.getTime()+300000||now.getTime()-observed.getTime()>72*3600000)throw Error("XE_STALE_DATA");
 if(new Set(data.to.map(x=>x.quotecurrency)).size!==2)throw Error("XE_INVALID_CURRENCIES");
 return {observed,rates:data.to.map(x=>{const rate=String(x.mid);ratio(rate);return {target:x.quotecurrency,rate};})};
}
export async function xeConfig():Promise<Config|null>{
 const row=await prisma.siteSetting.findUnique({where:{key:XE_CONFIG_KEY}});
 if(!row)return null;
 const config=configSchema.parse(JSON.parse(row.value));return {...config,apiKey:decryptSecret(config.apiKey)};
}
export async function saveXeConfig(raw:unknown,actorId:string){
 const next=configSchema.parse(raw),old=await xeConfig();
 if(!next.apiKey)next.apiKey=old?.apiKey||"";
 if(next.enabled&&!next.apiKey)throw Error("XE_KEY_REQUIRED");
 const stored={...next,apiKey:next.apiKey?encryptSecret(next.apiKey):""};
 await prisma.$transaction(async tx=>{await tx.siteSetting.upsert({where:{key:XE_CONFIG_KEY},create:{key:XE_CONFIG_KEY,value:JSON.stringify(stored)},update:{value:JSON.stringify(stored)}});await tx.siteSetting.deleteMany({where:{key:XE_HEALTH_KEY}});await tx.auditLog.create({data:{actorId,action:"billing_xe_configured",metadata:JSON.stringify({enabled:next.enabled,authMode:next.authMode})}});});
}
let pending:Promise<boolean>|null=null;
export async function syncXeRates(force=false,actorId="system:xe-rate-sync"):Promise<boolean>{
 if(pending)return pending;
 pending=performSync(force,actorId).finally(()=>{pending=null;});return pending;
}
async function performSync(force:boolean,actorId:string){
 const config=await xeConfig();if(!config?.enabled)return false;
 const now=new Date(),old=await prisma.siteSetting.findUnique({where:{key:XE_HEALTH_KEY}});
 const health=old?JSON.parse(old.value):{};
 if(health.status==="SYNCING"&&new Date(health.nextSyncAt)>now)return false;
 if(!force&&health.nextSyncAt&&new Date(health.nextSyncAt)>now)return false;
 const locked=JSON.stringify({...health,status:"SYNCING",nextSyncAt:new Date(now.getTime()+60000).toISOString()});
 if(old){if(!(await prisma.siteSetting.updateMany({where:{key:XE_HEALTH_KEY,value:old.value},data:{value:locked}})).count)return false;}
 else {try{await prisma.siteSetting.create({data:{key:XE_HEALTH_KEY,value:locked}});}catch{return false;}}
 try{
  const authorization=config.authMode==="BEARER"?"Bearer "+config.apiKey:"Basic "+Buffer.from(config.accountId+":"+config.apiKey).toString("base64");
  const response=await fetch("https://xecdapi.xe.com/v1/convert_from.json/?from=USD&to=TRY,EUR&amount=1",{headers:{Authorization:authorization,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("XE_HTTP_"+response.status);
  const result=validateXeRates(await response.json(),now);
  const validUntil=new Date(Math.min(result.observed.getTime()+72*3600000,now.getTime()+30*3600000));
  await prisma.$transaction(async tx=>{
   for(const rate of result.rates){const row=await tx.billingExchangeRate.create({data:{...rate,provider:"XE · "+result.observed.toISOString(),rateType:"COMMERCIAL",approvedBy:actorId,validUntil}});await tx.auditLog.create({data:{actorId,action:"billing_rate_synced",targetId:row.id,metadata:JSON.stringify({provider:"XE",observedAt:result.observed,rate:rate.rate,target:rate.target})}});}
   await tx.siteSetting.update({where:{key:XE_HEALTH_KEY},data:{value:JSON.stringify({status:"HEALTHY",lastSuccessAt:now,observedAt:result.observed,nextSyncAt:new Date(now.getTime()+12*3600000)})}});
  });return true;
 }catch(error){
  const message=error instanceof Error&&/^XE_(HTTP_\d{3}|STALE_DATA|INVALID_CURRENCIES)$/.test(error.message)?error.message:"XE_SYNC_FAILED";
  await prisma.siteSetting.update({where:{key:XE_HEALTH_KEY},data:{value:JSON.stringify({...health,status:"FAILED",error:message,lastAttemptAt:now,nextSyncAt:new Date(now.getTime()+3600000)})}});return false;
 }
}
export async function publicXeStatus(){const row=await prisma.siteSetting.findUnique({where:{key:XE_CONFIG_KEY}}),health=await prisma.siteSetting.findUnique({where:{key:XE_HEALTH_KEY}});const c=row?JSON.parse(row.value):{};return {configured:!!c.apiKey,enabled:!!c.enabled,accountId:c.accountId||"",authMode:c.authMode||"BEARER",health:health?JSON.parse(health.value):null};}
