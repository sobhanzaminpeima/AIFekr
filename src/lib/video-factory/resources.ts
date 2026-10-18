import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { configurationSchema, FactoryError } from "./domain";

export const agentRoles=["producer","researcher","writer","director","storyboard","continuity","image","video","motion","voice","music","editor","critic","publisher"] as const;
export const agentConfig=z.object({role:z.enum(agentRoles),systemPrompt:z.string().min(20).max(16000),modelId:z.string().max(100).default(""),allowedTools:z.array(z.enum(["plan","research","write","storyboard","generate_image","generate_video","generate_voice","generate_music","render","qc","publish"])).max(12),maxSteps:z.number().int().min(1).max(500),budgetCap:z.number().int().min(0).max(1000000),timeoutSeconds:z.number().int().min(5).max(120),maxRetries:z.number().int().min(0).max(5)}).strict();
export const templateConfig=z.object({description:z.string().max(3000),brief:z.string().max(10000),configuration:configurationSchema,captionStyle:z.enum(["CLEAN","BOXED","LARGE"]).default("CLEAN")}).strict();
export const userPolicyConfig=z.object({userId:z.string().min(1).max(100),enabled:z.boolean(),longFormEnabled:z.boolean(),maxProjectCredits:z.number().int().min(1).max(1000000),maxActivePerUser:z.number().int().min(1).max(10),allowedProviders:z.array(z.string().max(100)).max(50),dailyCredits:z.number().int().min(1).max(1000000)}).strict();
export const alertConfig=z.object({metric:z.enum(["QUEUED_JOBS","FAILED_JOBS","STORAGE_BYTES","UNCERTAIN_REQUESTS"]),threshold:z.number().int().min(1).max(100000000000),windowHours:z.number().int().min(1).max(720)}).strict();
export const resourceInput=z.discriminatedUnion("kind",[
  z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/),kind:z.literal("AGENT"),name:z.string().min(2).max(180),enabled:z.boolean(),expectedVersion:z.number().int().min(0),configuration:agentConfig}).strict(),
  z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/),kind:z.literal("TEMPLATE"),name:z.string().min(2).max(180),enabled:z.boolean(),expectedVersion:z.number().int().min(0),configuration:templateConfig}).strict(),
  z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/),kind:z.literal("USER_POLICY"),name:z.string().min(2).max(180),enabled:z.boolean(),expectedVersion:z.number().int().min(0),configuration:userPolicyConfig}).strict(),
  z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/),kind:z.literal("ALERT"),name:z.string().min(2).max(180),enabled:z.boolean(),expectedVersion:z.number().int().min(0),configuration:alertConfig}).strict(),
]);
export async function saveResource(actorId:string,input:unknown){
  const value=resourceInput.parse(input);
  if(value.kind==="USER_POLICY" && value.id!==`user_${value.configuration.userId}`)throw new FactoryError("USER_POLICY_ID_MISMATCH",400);
  if(value.kind==="AGENT" && value.id!==`agent_${value.configuration.role}`)throw new FactoryError("AGENT_ID_MISMATCH",400);
  return prisma.$transaction(async tx=>{
    const old=await tx.videoFactoryResource.findUnique({where:{id:value.id}});
    if(old && (old.version!==value.expectedVersion || old.kind!==value.kind))throw new FactoryError("VERSION_CONFLICT");
    if(!old && value.expectedVersion!==0)throw new FactoryError("VERSION_CONFLICT");
    if(old)await tx.videoFactoryConfigVersion.create({data:{resourceId:old.id,kind:old.kind,version:old.version,configuration:JSON.stringify({name:old.name,enabled:old.enabled,configuration:JSON.parse(old.configuration)}),actorId}});
    const data={kind:value.kind,name:value.name,enabled:value.enabled,configuration:JSON.stringify(value.configuration),version:(old?.version || 0)+1};
    if(old){const changed=await tx.videoFactoryResource.updateMany({where:{id:value.id,version:old.version},data});if(!changed.count)throw new FactoryError("VERSION_CONFLICT");}
    else await tx.videoFactoryResource.create({data:{id:value.id,...data}});
    await tx.auditLog.create({data:{actorId,action:"video_factory.resource_saved",targetId:value.id,metadata:JSON.stringify({kind:value.kind,version:data.version})}});
    return {id:value.id,...data,configuration:value.configuration};
  });
}
export async function rollbackResource(actorId:string,id:string,version:number,expectedVersion:number){
  const saved=await prisma.videoFactoryConfigVersion.findFirst({where:{resourceId:id,version,kind:{in:["AGENT","TEMPLATE","USER_POLICY","ALERT"]}}});
  if(!saved)throw new FactoryError("VERSION_NOT_FOUND",404);
  return saveResource(actorId,{id,kind:saved.kind,expectedVersion,...JSON.parse(saved.configuration)});
}
export async function listResources(kind?:string){const rows=await prisma.videoFactoryResource.findMany({where:kind?{kind}:{},orderBy:{updatedAt:"desc"},take:200});return rows.map(r=>({...r,configuration:JSON.parse(r.configuration)}));}
export async function agentSettings(role:typeof agentRoles[number]){
  const row=await prisma.videoFactoryResource.findFirst({where:{id:`agent_${role}`,kind:"AGENT"}});
  if(!row)return null;if(!row.enabled)throw new FactoryError("AGENT_DISABLED",503);
  return {version:row.version,...agentConfig.parse(JSON.parse(row.configuration))};
}
export async function enforceRole(role:typeof agentRoles[number],tool:z.infer<typeof agentConfig>["allowedTools"][number],step:number,credits:number){
 const settings=await agentSettings(role);if(settings && (!settings.allowedTools.includes(tool)||step>=settings.maxSteps||credits>settings.budgetCap))throw new FactoryError("AGENT_POLICY_DENIED",403);return settings;
}
export async function getUserPolicy(userId:string){const row=await prisma.videoFactoryResource.findFirst({where:{id:`user_${userId}`,kind:"USER_POLICY",enabled:true}});return row?userPolicyConfig.parse(JSON.parse(row.configuration)):null;}
export async function enforceUserPolicy(userId:string,credits:number,providerIds:string[],longForm:boolean){
  const policy=await getUserPolicy(userId);if(!policy)return;
  if(!policy.enabled || credits>policy.maxProjectCredits || (longForm && !policy.longFormEnabled) || providerIds.some(id=>id && !policy.allowedProviders.includes(id)))throw new FactoryError("USER_PRODUCTION_POLICY_DENIED",403);
  const day=new Date();day.setHours(0,0,0,0);
  const usage=await prisma.videoFactoryJob.aggregate({where:{userId,createdAt:{gte:day}},_sum:{spentCredits:true}});
  if((usage._sum.spentCredits || 0)+credits>policy.dailyCredits)throw new FactoryError("DAILY_CREDIT_CAP",402);
}
