export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { eventDuration } from "@/lib/voice/eventDuration";
import { timingSafeEqual } from "crypto";
import { voiceSettings } from "@/lib/voice/settings";
import { reserveVoiceCall, settleVoiceCall } from "@/lib/voice/billing";
import { hasVoiceAccess } from "@/lib/voice/workspace";
import { prisma } from "@/lib/db/prisma";
import { matchCrmContactByPhone } from "@/lib/voice/crmLink";
import { notify } from "@/lib/notifications/create";
import { wrapUntrustedContent } from "@/lib/ai/promptSafety";

/**
 * Vapi's single server-side webhook — handles both mid-call tool invocations
 * ("tool-calls") and the final call summary ("end-of-call-report"). Same
 * shape for every VoiceAgent; which agent/user a call belongs to is resolved
 * from the assistant id Vapi includes on every message.
 *
 * Auth: if VAPI_WEBHOOK_SECRET is set, reject anything that doesn't present
 * it. Vapi's dashboard "Server URL" credential only offers OAuth 2.0 / HMAC /
 * Bearer Token as custom-credential types (no plain "secret header" option),
 * so this is configured as a Bearer Token credential in Vapi — sent as
 * `Authorization: Bearer <secret>`. Also accepts the legacy `x-vapi-secret`
 * header for forward-compat with older Vapi accounts that still send it.
 * Left optional (passes when unset) so the route still works before a real
 * Vapi account is wired up.
 */
async function verifySecret(req: NextRequest): Promise<boolean> {
  const { webhookSecret: expected } = await voiceSettings();
  if (!expected) return false;
  const provided = req.headers.get("authorization")?.replace(/^Bearer /, "") || req.headers.get("x-vapi-secret") || "";
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface VapiToolCall {
  id: string;
  function: { name: string; arguments: Record<string, unknown> | string };
}

interface VapiMessage {
  type: string;
  call?: { id: string; assistantId?: string; customer?: { number?: string }; phoneNumberId?: string; type?: string; startedAt?: string; endedAt?: string; metadata?: { reservationId?: string } };
  toolCalls?: VapiToolCall[];
  toolCallList?: VapiToolCall[];
  assistant?: { id?: string };
  phoneNumber?: { id?: string };
  artifact?: { transcript?: string; recordingUrl?: string };
  analysis?: { summary?: string };
  startedAt?: string;
  endedAt?: string;
  // end-of-call-report fields
  endedReason?: string;
  transcript?: string;
  summary?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  cost?: number;
}

export async function POST(req: NextRequest) {
  if (!await verifySecret(req)) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const message: VapiMessage | undefined = payload?.message;
  if (!message) return NextResponse.json({ error: "missing message" }, { status: 400 });

  try {
    if (message.type === "assistant-request") {
      const numberId = message.phoneNumber?.id || message.call?.phoneNumberId;
      const agent = numberId ? await prisma.voiceAgent.findFirst({ where: { vapiPhoneNumberId: numberId, isActive: true } }) : null;
      if (!agent?.vapiAssistantId || !message.call?.id) return NextResponse.json({ error: "This number is unavailable." });
      const owner = await prisma.user.findUnique({ where: { id: agent.userId } });
      if (!owner || owner.isBlocked || !hasVoiceAccess(owner)) return NextResponse.json({ error: "Subscription is unavailable." });
      const settings = await voiceSettings();
      try { await reserveVoiceCall(agent, message.call.id, settings.creditsPerMinute, settings.maxDurationSeconds, "inbound", undefined, message.call.customer?.number); }
      catch { return NextResponse.json({ error: "Insufficient call credits or call unavailable." }); }
      return NextResponse.json({ assistantId: agent.vapiAssistantId, assistantOverrides: { maxDurationSeconds: settings.maxDurationSeconds, variableValues: { currentDate: new Date().toISOString(), timezone: agent.timezone } } });
    }
    const toolCalls = message.toolCallList || message.toolCalls;
    if (message.type === "tool-calls" && toolCalls?.length && toolCalls.length <= 10) {
      const results = [];
      for (const tc of toolCalls) {
        try { results.push(await handleToolCall(tc, message)); }
        catch { results.push({ toolCallId: tc.id, result: "Unable to complete this request. Ask the caller to contact reception." }); }
      }
      return NextResponse.json({ results });
    }

    if (message.type === "end-of-call-report") {
      await handleEndOfCall(message);
      return NextResponse.json({ ok: true });
    }

    // Any other Vapi event (status-update, transcript, speech-update, …) —
    // we don't need it, ack fast so Vapi doesn't retry.
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("vapi webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed; retry." }, { status: 500 });
  }
}

async function findAgentByAssistantId(assistantId: string | undefined) {
  if (!assistantId) return null;
  return prisma.voiceAgent.findFirst({ where: { vapiAssistantId: assistantId } });
}

function parseArgs(args: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args || {};
}

async function handleToolCall(tc: VapiToolCall, message: VapiMessage) {
  const agent = await findAgentByAssistantId(message.call?.assistantId || message.assistant?.id);
  if (!agent?.isActive || !message.call?.id) return { toolCallId: tc.id, result: "Agent unavailable" };
  const owner = await prisma.user.findUnique({ where: { id: agent.userId } });
  if (!owner || owner.isBlocked || !hasVoiceAccess(owner)) return { toolCallId: tc.id, result: "Subscription unavailable" };
  const admission=await prisma.voiceCallLog.findUnique({where:{vapiCallId:message.call.id}});
  if(!admission||admission.agentId!==agent.id||admission.billingStatus!=="pending") return {toolCallId:tc.id,result:"Call admission unavailable"};
  const args = parseArgs(tc.function.arguments);
  if (["search_properties","check_property_status"].includes(tc.function.name) && agent.vertical !== "real_estate") return { toolCallId: tc.id, result: "Tool unavailable for this scenario" };

  if (tc.function.name === "search_properties") {
    if (!agent) return { toolCallId: tc.id, result: "ایجنت یافت نشد" };
    const { listingType, propertyType, city, maxPrice } = args as {
      listingType?: string; propertyType?: string; city?: string; maxPrice?: number;
    };
    const matches = await prisma.property.findMany({
      where: {
        userId: agent.userId,
        businessId: agent.businessId,
        status: "available",
        ...(listingType ? { listingType: String(listingType) } : {}),
        ...(propertyType ? { propertyType: String(propertyType) } : {}),
        ...(city ? { city: String(city) } : {}),
        ...(typeof maxPrice === "number" && Number.isFinite(maxPrice) && maxPrice >= 0 && maxPrice <= Number.MAX_SAFE_INTEGER ? { price: { lte: BigInt(Math.round(maxPrice)) } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
    });
    const summary = matches.length
      ? matches.map((p) => `${p.title} — ${p.address}، ${Number(p.price).toLocaleString("fa-IR")} تومان (شناسه: ${p.id})`).join(" | ")
      : "در حال حاضر ملکی مطابق این معیارها موجود نیست.";
    return { toolCallId: tc.id, result: wrapUntrustedContent("Property information", summary) };
  }

  if (tc.function.name === "check_property_status") {
    if (!agent) return { toolCallId: tc.id, result: "ایجنت یافت نشد" };
    const { propertyId } = args as { propertyId?: string };
    if (!propertyId) return { toolCallId: tc.id, result: "شناسه ملک ارسال نشده است." };
    const property = await prisma.property.findUnique({ where: { id: String(propertyId) } });
    if (!property || (property.userId !== agent.userId || property.businessId !== agent.businessId)) {
      return { toolCallId: tc.id, result: "ملکی با این شناسه یافت نشد." };
    }
    const STATUS_LABELS: Record<string, string> = {
      available: "موجود و قابل بازدید",
      pending: "در حال معامله (رزرو شده)",
      sold: "فروخته شده",
      rented: "اجاره داده شده",
    };
    const label = STATUS_LABELS[property.status] || property.status;
    return { toolCallId: tc.id, result: `وضعیت فعلی «${property.title}»: ${label}.${property.status !== "available" ? " این ملک را برای بازدید پیشنهاد نده." : ""}` };
  }

  if (tc.function.name === "search_knowledge_base") {
    if (!agent) return { toolCallId: tc.id, result: "ایجنت یافت نشد" };
    const { query } = args as { query?: string };
    const terms = String(query || "").slice(0,300).split(/\s+/).filter((w) => w.length > 1);
    // No FTS/vector index for this yet — SQLite LIKE per term is plenty at
    // knowledge-base scale (a few dozen entries per agent, not thousands).
    const entries = await prisma.voiceKnowledgeBase.findMany({
      where: {
        userId: agent.userId,
        businessId: agent.businessId,
        AND: [
          { OR: [{ agentId: agent.id }, { agentId: null }] },
          ...terms.map((t) => ({ OR: [{ title: { contains: t } }, { content: { contains: t } }] })),
        ],
      },
      take: 3,
    });
    const summary = entries.length
      ? entries.map((e) => `${e.title}: ${e.content}`).join(" | ")
      : "پاسخ این سوال در دانش‌نامه موجود نیست — به تماس‌گیرنده بگویید کارشناس پیگیری خواهد کرد.";
    // Knowledge-base content is user-uploaded (pasted text or a parsed
    // PDF/DOCX) and reaches the live call assistant's context verbatim —
    // mark it as reference data, not instructions, before it's returned.
    return { toolCallId: tc.id, result: wrapUntrustedContent("دانش‌نامه", summary) };
  }

  if (tc.function.name === "book_appointment") {
    if (!agent) return { toolCallId: tc.id, result: "ایجنت یافت نشد" };
    // propertyId only applies to real_estate-vertical agents; `note` is the
    // general-vertical equivalent (reason for the callback/appointment).
    const { propertyId, leadName, leadPhone, scheduledAtIso, note } = args as {
      propertyId?: string; leadName?: string; leadPhone?: string; scheduledAtIso?: string; note?: string;
    };
    const scheduledAt = typeof scheduledAtIso === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledAtIso) ? new Date(scheduledAtIso) : null;
    if (typeof leadName!=="string" || !leadName.trim() || typeof leadPhone!=="string" || !/^\+?[0-9\s()-]{7,25}$/.test(leadPhone) || !scheduledAt || isNaN(scheduledAt.getTime())) {
      return { toolCallId: tc.id, result: "برای رزرو، نام، شماره تماس و زمان معتبر لازم است." };
    }
    if (scheduledAt.getTime() <= Date.now() || scheduledAt.getTime() > Date.now()+180*86400000) return {toolCallId:tc.id,result:"Choose a future appointment within 180 days."};
    const parts = new Intl.DateTimeFormat("en",{timeZone:agent.timezone,hour:"numeric",minute:"numeric",hourCycle:"h23"}).formatToParts(scheduledAt);
    const hour = Number(parts.find(p=>p.type==="hour")?.value);
    const minute = Number(parts.find(p=>p.type==="minute")?.value);
    if (hour < agent.openingHour || hour*60+minute+agent.appointmentMinutes > agent.closingHour*60) return {toolCallId:tc.id,result:`Reception hours: ${agent.openingHour}:00–${agent.closingHour}:00 (${agent.timezone}). Choose another time.`};
    const key = `${message.call.id}:${tc.id}`;
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.voiceAppointment.findUnique({where:{toolCallId:key}});
      if(existing) return existing;
      if(propertyId) {
        const property = await tx.property.findUnique({where:{id:String(propertyId)}});
        if(!property || property.userId!==agent.userId || property.businessId!==agent.businessId || property.status!=="available") throw new Error("PROPERTY_UNAVAILABLE");
      }
      const window = agent.appointmentMinutes*60000;
      const conflict=await tx.voiceAppointment.findFirst({where:{agentId:agent.id,status:{in:["pending","confirmed"]},scheduledAt:{gt:new Date(scheduledAt.getTime()-window),lt:new Date(scheduledAt.getTime()+window)}}});
      if(conflict) return null;
      return tx.voiceAppointment.create({data:{userId:agent.userId,businessId:agent.businessId,agentId:agent.id,toolCallId:key,propertyId:propertyId?String(propertyId):undefined,leadName:String(leadName).trim().slice(0,150),leadPhone:String(leadPhone).slice(0,30),scheduledAt,status:"pending",notes:typeof note==="string"?note.slice(0,1000):undefined}});
    });
    return {toolCallId:tc.id,result:result?`Appointment request recorded for ${result.scheduledAt.toISOString()} (${agent.timezone}); pending receptionist confirmation.`:"That slot is unavailable. Ask the caller to choose another time."};
  }

  return { toolCallId: tc.id, result: "ابزار نامعتبر" };
}

async function handleEndOfCall(message: VapiMessage) {
  const agent = await findAgentByAssistantId(message.call?.assistantId || message.assistant?.id);
  if (!agent || !message.call?.id) return;
  const seconds = eventDuration(message);
  const summary=message.analysis?.summary || message.summary;
  const transcript=message.artifact?.transcript || message.transcript;
  const contactId=await matchCrmContactByPhone(agent.userId,message.call.customer?.number,agent.businessId).catch(()=>null);
  let call=await prisma.voiceCallLog.findUnique({where:{vapiCallId:message.call.id}});
  if(!call && message.call.metadata?.reservationId) {
    call=await prisma.voiceCallLog.findUnique({where:{id:message.call.metadata.reservationId}});
    if(call && call.agentId===agent.id && (!call.vapiCallId || call.vapiCallId===message.call.id)) await prisma.voiceCallLog.update({where:{id:call.id},data:{vapiCallId:message.call.id}});
    else call=null;
  }
  if(!call) {
    const settings=await voiceSettings();
    const membership=await prisma.teamMember.findUnique({where:{userId:agent.userId}});
    call=await prisma.voiceCallLog.create({data:{userId:agent.userId,businessId:agent.businessId,agentId:agent.id,vapiCallId:message.call.id,creditsPerMinute:settings.creditsPerMinute,creditTeamId:membership?.teamId,direction:message.call.type==="outboundPhoneCall"?"outbound":"inbound",callerPhone:message.call.customer?.number,status:"awaiting_billing"}});
  }
  if(call.agentId!==agent.id) throw new Error("CALL_OWNER_MISMATCH");
  const appointment=await prisma.voiceAppointment.findFirst({where:{agentId:agent.id,toolCallId:{startsWith:`${message.call.id}:`}}});
  const result=await settleVoiceCall(call.id,seconds,{status:seconds===0?"no_answer":"completed",outcome:appointment?"appointment_booked":"unknown",contactId:contactId||undefined,summary:summary?.slice(0,10000),transcript:transcript?.slice(0,100000),recordingUrl:message.artifact?.recordingUrl||message.recordingUrl,cost:typeof message.cost==="number"&&Number.isFinite(message.cost)&&message.cost>=0?message.cost:undefined}).catch(async(error)=>{await prisma.voiceCallLog.update({where:{id:call!.id},data:{status:"awaiting_billing",durationSec:Math.ceil(seconds),summary:summary?.slice(0,10000),transcript:transcript?.slice(0,100000)}});throw error;});
  if(!result.fresh) return;
  if(contactId) await prisma.crmActivity.create({data:{userId:agent.userId,contactId,type:"call",content:summary||`Voice call: ${agent.name} (${seconds}s)`}}).catch(()=>{});
  await notify(agent.userId,{type:"voice_call",title:`تماس پایان یافت: ${agent.name}`,body:`${result.call.creditsCharged} credits · ${Math.ceil(seconds)}s`,link:"/voice-agent"}).catch(()=>{});
}
