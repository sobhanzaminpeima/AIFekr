import { encryptSecret } from "@/lib/crypto/secretBox";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { voiceSettings } from "@/lib/voice/settings";
const keys = ["vapi_private_key","vapi_webhook_secret","vapi_credential_id","vapi_model","vapi_voice_id","vapi_credits_per_minute","vapi_max_duration_seconds"];
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return forbiddenResponse();
  const s = await voiceSettings();
  return NextResponse.json({ apiKeyConfigured:!!s.apiKey, webhookConfigured:!!s.webhookSecret, credentialId:s.credentialId, model:s.model, voiceId:s.voiceId, creditsPerMinute:s.creditsPerMinute, maxDurationSeconds:s.maxDurationSeconds, webhookUrl:`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/vapi` });
}
export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return forbiddenResponse();
  const body = await req.json().catch(()=>null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"Invalid configuration"},{status:400});
  for(const [key,value] of Object.entries(body)) {
    if(!keys.includes(key) || typeof value!=="string" || value.length>1000) return NextResponse.json({error:"Invalid setting"},{status:400});
    if(key==="vapi_webhook_secret" && value.trim().length<32) return NextResponse.json({error:"Webhook secret must contain at least 32 characters"},{status:400});
    if(key==="vapi_credits_per_minute" && (!Number.isInteger(Number(value)) || Number(value)<1 || Number(value)>10000)) return NextResponse.json({error:"Invalid credit rate"},{status:400});
    if(key==="vapi_max_duration_seconds" && (!Number.isInteger(Number(value)) || Number(value)<60 || Number(value)>1800)) return NextResponse.json({error:"Call duration must be 60–1800 seconds"},{status:400});
  }
  await prisma.$transaction(Object.entries(body).map(([key,value])=>prisma.siteSetting.upsert({where:{key},create:{key,value:["vapi_private_key","vapi_webhook_secret"].includes(key)?encryptSecret(String(value).trim()):String(value).trim()},update:{value:["vapi_private_key","vapi_webhook_secret"].includes(key)?encryptSecret(String(value).trim()):String(value).trim()}})));
  return NextResponse.json({ok:true});
}
