export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hasVoiceAccess, countUserVoiceAgents, FREE_VOICE_AGENT_LIMIT } from "@/lib/voice/workspace";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";

import { scenarioPrompt, VOICE_SCENARIOS } from "@/lib/voice/scenarios";
import { getServerLang } from "@/lib/i18n/server";
import { voiceSettings } from "@/lib/voice/settings";
import { getAvailableCredits } from "@/lib/utils/teamCredits";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const businessId = await activeBusinessIdFor(user.id);
  const agents = await prisma.voiceAgent.findMany({
    where: { userId: user.id, businessId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { calls: true, appointments: true } } },
  });
  const settings=await voiceSettings();
  return NextResponse.json({ agents:agents.map(({vapiAssistantId,vapiPhoneNumberId,...agent})=>({...agent,connected:!!(vapiAssistantId&&vapiPhoneNumberId&&agent.phoneNumber)})), voicePlan: hasVoiceAccess(user)?"ACTIVE":"NONE", hasAccess: hasVoiceAccess(user), credits:await getAvailableCredits(user.id), creditsPerMinute:settings.creditsPerMinute,maxDurationSeconds:settings.maxDurationSeconds,configured:!!(settings.apiKey&&settings.webhookSecret&&settings.credentialId) });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const count = await countUserVoiceAgents(user.id);
  if (!hasVoiceAccess(user) && count >= FREE_VOICE_AGENT_LIMIT) {
    return NextResponse.json(
      { error: `پلن رایگان حداکثر ${FREE_VOICE_AGENT_LIMIT} ایجنت صوتی را پشتیبانی می‌کند. برای ایجنت بیشتر، افزونه Voice Agent را فعال کنید.` },
      { status: 402 }
    );
  }

  const body = await req.json().catch(()=>null);
  if(!body) return NextResponse.json({error:"Invalid request"},{status:400});
  const { name, focus, systemPrompt, voiceId, vertical, businessType } = body;
  if (typeof name!=="string" || !name.trim() || name.length>150) return NextResponse.json({ error: "نام ایجنت الزامی است" }, { status: 400 });

  if(voiceId!==undefined&&voiceId!==null&&(typeof voiceId!=="string"||voiceId.length>200)) return NextResponse.json({error:"Invalid voice"},{status:400});
  const resolvedVertical = VOICE_SCENARIOS.includes(vertical) ? vertical : "general";
  const language=["fa","en","de","tr"].includes(body.language)?body.language:await getServerLang();
  const timezone=typeof body.timezone==="string"?body.timezone:"Europe/Istanbul";
  try {new Intl.DateTimeFormat("en",{timeZone:timezone}).format();}catch{return NextResponse.json({error:"Invalid timezone"},{status:400});}
  const openingHour=body.openingHour??9, closingHour=body.closingHour??18, appointmentMinutes=body.appointmentMinutes??30;
  if(!Number.isInteger(openingHour)||!Number.isInteger(closingHour)||openingHour<0||closingHour>24||openingHour>=closingHour||![15,30,45,60].includes(appointmentMinutes)) return NextResponse.json({error:"Invalid reception schedule"},{status:400});
  if(systemPrompt!==undefined&&(typeof systemPrompt!=="string"||systemPrompt.length>20000)) return NextResponse.json({error:"Invalid prompt"},{status:400});
  const resolvedFocus = resolvedVertical !== "real_estate"
    ? "general"
    : (["buy", "sell", "rent", "general"].includes(focus) ? focus : "general");
  const resolvedBusinessType = resolvedVertical !== "real_estate" && typeof businessType === "string" && businessType.trim()
    ? businessType.trim().slice(0, 200)
    : null;

  const businessId=await activeBusinessIdFor(user.id);
  const agent = await prisma.$transaction(async tx=>{
    if(await tx.voiceAgent.count({where:{userId:user.id}})>=(hasVoiceAccess(user)?100:FREE_VOICE_AGENT_LIMIT))return null;
    return tx.voiceAgent.create({
    data: {
      userId: user.id,
      businessId,
      name: name.trim(),
      language, timezone, openingHour, closingHour, appointmentMinutes,
      focus: resolvedFocus,
      vertical: resolvedVertical,
      businessType: resolvedBusinessType,
      systemPrompt: systemPrompt?.trim() || scenarioPrompt(resolvedVertical, resolvedBusinessType || name.trim(), language),
      voiceId: voiceId || undefined,
    },
  });
  });
  if(!agent)return NextResponse.json({error:"Voice assistant limit reached"},{status:402});
  return NextResponse.json({ agent });
}
