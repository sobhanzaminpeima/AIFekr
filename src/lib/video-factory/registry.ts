import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretBox";
import { FactoryError } from "./domain";
import type {VideoFactoryProvider} from "@prisma/client";

export const mediaKinds = ["TEXT", "IMAGE", "VIDEO", "TTS", "MUSIC","CLONE","ALIGNMENT","TRANSCRIPTION","VISION","SFX"] as const;
export type MediaKind = typeof mediaKinds[number];
export const providerInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/), name: z.string().min(2).max(180),
  kind: z.enum(mediaKinds), adapter: z.enum(["CLOUDFLARE_TEXT","CLOUDFLARE_IMAGE","ANTHROPIC_TEXT","GEMINI_TEXT","OPENAI_COMPAT_TEXT","OPENAI_IMAGE", "OPENAI_VIDEO", "OPENAI_TTS", "ELEVENLABS_MUSIC","ELEVENLABS_TTS","ELEVENLABS_CLONE","ELEVENLABS_ALIGNMENT","ELEVENLABS_TRANSCRIPTION","OPENAI_VISION","ELEVENLABS_SFX","GEMINI_IMAGE","GEMINI_VISION"]),
  model: z.string().regex(/^(?:[a-zA-Z0-9._-]{1,100}|@cf\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)$/), enabled: z.boolean(),
  secret: z.string().max(2000).optional(), credentialRef: z.enum(["ANTHROPIC_API_KEY","OPENAI_API_KEY", "ELEVENLABS_API_KEY","GEMINI_API_KEY"]).nullable().default(null),
  settings: z.object({ baseUrl:z.string().url().max(500).optional(), maxOutputTokens:z.number().int().min(1000).max(16000).optional(), commercialApproved: z.boolean(), safetyReviewed: z.boolean(), region: z.string().max(100).default(""), languages: z.array(z.string().max(10)).max(100).default([]), maxConcurrent: z.number().int().min(1).max(10).default(1), requestsPerMinute: z.number().int().min(1).max(300).default(10),defaultVoiceId:z.string().regex(/^[a-zA-Z0-9_-]{0,100}$/).default("") }).strict(),
  pricing: z.object({ unitUsd: z.number().finite().min(0).max(1000).nullable(), unit: z.enum(["image", "second", "request", "minute"]), verifiedAt: z.string().datetime().nullable() }).strict(),
}).strict().superRefine((v, ctx) => {
  if(v.kind==="TEXT" && !v.id.startsWith("vf-"))ctx.addIssue({code:"custom",message:"Text provider IDs must start with vf-"});
  const kinds = { CLOUDFLARE_TEXT:"TEXT",CLOUDFLARE_IMAGE:"IMAGE",ANTHROPIC_TEXT:"TEXT",GEMINI_TEXT:"TEXT",OPENAI_COMPAT_TEXT:"TEXT", OPENAI_IMAGE:"IMAGE",OPENAI_VIDEO:"VIDEO",OPENAI_TTS:"TTS",ELEVENLABS_MUSIC:"MUSIC",ELEVENLABS_TTS:"TTS",ELEVENLABS_CLONE:"CLONE",ELEVENLABS_ALIGNMENT:"ALIGNMENT",ELEVENLABS_TRANSCRIPTION:"TRANSCRIPTION",OPENAI_VISION:"VISION",ELEVENLABS_SFX:"SFX",GEMINI_IMAGE:"IMAGE",GEMINI_VISION:"VISION" };
  if (kinds[v.adapter] !== v.kind) ctx.addIssue({code:"custom",message:"Adapter capability mismatch"});
  if (v.adapter === "OPENAI_COMPAT_TEXT") {
    if (!v.settings.baseUrl) ctx.addIssue({code:"custom",path:["settings","baseUrl"],message:"Base URL is required"});
    else {
      const url = new URL(v.settings.baseUrl);
      if (url.protocol !== "https:" || url.username || url.password) ctx.addIssue({code:"custom",path:["settings","baseUrl"],message:"Base URL must be a credential-free HTTPS URL"});
    }
  }
  if (v.enabled && (!v.settings.commercialApproved || !v.settings.safetyReviewed)) ctx.addIssue({code:"custom",message:"Commercial and safety approval required"});
  if (v.credentialRef && v.credentialRef !== (v.adapter.startsWith("ANTHROPIC_")?"ANTHROPIC_API_KEY":v.adapter.startsWith("GEMINI_")?"GEMINI_API_KEY":v.adapter.startsWith("ELEVENLABS_") ? "ELEVENLABS_API_KEY" : "OPENAI_API_KEY")) ctx.addIssue({code:"custom",message:"Credential does not match adapter"});
});
export type RegisteredProvider = Awaited<ReturnType<typeof getMediaProvider>>;
export async function saveMediaProvider(actorId: string, input: unknown) {
  const value = providerInput.parse(input);
  return prisma.$transaction(async tx => {
    const previous = await tx.videoFactoryProvider.findUnique({where:{id:value.id}});
    const sameCredentialScope=previous?.adapter.split("_")[0]===value.adapter.split("_")[0] && previous?.credentialRef===value.credentialRef;
    const secret = value.secret ? encryptSecret(value.secret) : sameCredentialScope?previous?.secret || null:null;
    if(value.adapter.startsWith("CLOUDFLARE_"))await (await import("@/lib/cloudflare/workersAi")).workersAiCredentials();
    if (value.enabled && !value.adapter.startsWith("CLOUDFLARE_") && !secret && !(value.credentialRef && process.env[value.credentialRef])) throw new FactoryError("PROVIDER_CREDENTIAL_REQUIRED",400);
    if (previous) await tx.videoFactoryConfigVersion.create({data:{resourceId:value.id,kind:"PROVIDER",version:previous.version,configuration:JSON.stringify({...previous,secret:undefined}),actorId}});
    const row = {name:value.name,kind:value.kind,adapter:value.adapter,model:value.model,enabled:value.enabled,credentialRef:value.credentialRef,secret,settings:JSON.stringify(value.settings),pricing:JSON.stringify(value.pricing),version:(previous?.version || 0)+1};
    const saved = await tx.videoFactoryProvider.upsert({where:{id:value.id},create:{id:value.id,...row},update:row});
    await tx.auditLog.create({data:{actorId,action:"video_factory.provider_saved",targetId:value.id,metadata:JSON.stringify({version:saved.version,enabled:saved.enabled,credentialChanged:!!value.secret})}});
    return publicProvider(saved);
  });
}
export function publicProvider(row: VideoFactoryProvider) {
  const {secret,...safe} = row;
  return {...safe,settings:providerInput.shape.settings.parse(JSON.parse(row.settings)),pricing:providerInput.shape.pricing.parse(JSON.parse(row.pricing)),configured:row.adapter.startsWith("CLOUDFLARE_") || !!secret || !!(row.credentialRef && process.env[row.credentialRef])};
}
export async function getMediaProvider(id: string, kind: MediaKind, fallbackIds: string[] = []) {
  for (const candidate of [id,...fallbackIds]) {
    const row = await prisma.videoFactoryProvider.findFirst({where:{id:candidate,kind,enabled:true}});
    if (!row || (row.circuitUntil && row.circuitUntil > new Date())) continue;
    const settings = providerInput.shape.settings.parse(JSON.parse(row.settings));
    if (!settings.commercialApproved || !settings.safetyReviewed) continue;
    const key = row.adapter.startsWith("CLOUDFLARE_")?(await (await import("@/lib/cloudflare/workersAi")).workersAiCredentials()).key:row.secret ? decryptSecret(row.secret) : row.credentialRef ? process.env[row.credentialRef] : undefined;
    if (key) return {...row,settings,pricing:JSON.parse(row.pricing) as z.infer<typeof providerInput>["pricing"],key};
  }
  throw new FactoryError(`NO_APPROVED_${kind}_PROVIDER`,503);
}
export async function recordProviderHealth(id:string, success:boolean) {
  await prisma.$transaction(async tx=>{
    const row=await tx.videoFactoryProvider.findUniqueOrThrow({where:{id}}),failures=success?0:row.failures+1;
    await tx.videoFactoryProvider.update({where:{id},data:{failures,health:success?"HEALTHY":"DEGRADED",checkedAt:new Date(),circuitUntil:failures>=3?new Date(Date.now()+300000):null}});
  });
}
export async function probeMediaProvider(actorId:string,id:string) {
  const row=await prisma.videoFactoryProvider.findUnique({where:{id}});
  if(!row)throw new FactoryError("PROVIDER_NOT_FOUND",404);
  if(row.adapter.startsWith("CLOUDFLARE_")){const result=await (await import("@/lib/cloudflare/workersAi")).probeWorkersAi();const healthy=result.models.some(m=>m.name===row.model);await recordProviderHealth(id,healthy);return {healthy,httpStatus:healthy?200:404,paidRequest:false};}
  const key=row.secret?decryptSecret(row.secret):row.credentialRef?process.env[row.credentialRef]:undefined;
  if(!key)throw new FactoryError("PROVIDER_CREDENTIAL_REQUIRED",400);
  const settings=providerInput.shape.settings.parse(JSON.parse(row.settings));
  const compatBase=row.adapter==="OPENAI_COMPAT_TEXT"?settings.baseUrl?.replace(/\/$/,""):null;
  const response=await fetch(row.adapter.startsWith("ANTHROPIC_")?`https://api.anthropic.com/v1/models/${encodeURIComponent(row.model)}`:row.adapter.startsWith("GEMINI_")?`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(row.model)}`:row.adapter.startsWith("ELEVENLABS_")?"https://api.elevenlabs.io/v1/models":compatBase?`${compatBase}/models/${encodeURIComponent(row.model)}`:`https://api.openai.com/v1/models/${encodeURIComponent(row.model)}`,{headers:row.adapter.startsWith("ANTHROPIC_")?{"x-api-key":key,"anthropic-version":"2023-06-01"}:row.adapter.startsWith("GEMINI_")?{"x-goog-api-key":key}:row.adapter.startsWith("ELEVENLABS_")?{"xi-api-key":key}:{Authorization:`Bearer ${key}`},redirect:"error",signal:AbortSignal.timeout(10000)});
  await response.body?.cancel(); await recordProviderHealth(id,response.ok);
  await prisma.auditLog.create({data:{actorId,action:"video_factory.provider_probe",targetId:id,metadata:JSON.stringify({httpStatus:response.status,paidRequest:false})}});
  return {healthy:response.ok,httpStatus:response.status,paidRequest:false};
}


