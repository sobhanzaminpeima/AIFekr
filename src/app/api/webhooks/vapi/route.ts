export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
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
function verifySecret(req: NextRequest): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return true;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${expected}`) return true;
  return req.headers.get("x-vapi-secret") === expected;
}

interface VapiToolCall {
  id: string;
  function: { name: string; arguments: Record<string, unknown> | string };
}

interface VapiMessage {
  type: string;
  call?: { id: string; assistantId?: string; customer?: { number?: string } };
  toolCalls?: VapiToolCall[];
  // end-of-call-report fields
  endedReason?: string;
  transcript?: string;
  summary?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  cost?: number;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const message: VapiMessage | undefined = payload?.message;
  if (!message) return NextResponse.json({ error: "missing message" }, { status: 400 });

  try {
    if (message.type === "tool-calls" && message.toolCalls?.length) {
      const results = await Promise.all(message.toolCalls.map((tc) => handleToolCall(tc, message)));
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
    return NextResponse.json({ ok: true }); // ack anyway — Vapi retries on non-2xx and we don't want a call stuck retrying
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
  const agent = await findAgentByAssistantId(message.call?.assistantId);
  const args = parseArgs(tc.function.arguments);

  if (tc.function.name === "search_properties") {
    if (!agent) return { toolCallId: tc.id, result: "ایجنت یافت نشد" };
    const { listingType, propertyType, city, maxPrice } = args as {
      listingType?: string; propertyType?: string; city?: string; maxPrice?: number;
    };
    const matches = await prisma.property.findMany({
      where: {
        userId: agent.userId,
        status: "available",
        ...(listingType ? { listingType: String(listingType) } : {}),
        ...(propertyType ? { propertyType: String(propertyType) } : {}),
        ...(city ? { city: String(city) } : {}),
        ...(typeof maxPrice === "number" ? { price: { lte: BigInt(Math.round(maxPrice)) } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
    });
    const summary = matches.length
      ? matches.map((p) => `${p.title} — ${p.address}، ${Number(p.price).toLocaleString("fa-IR")} تومان (شناسه: ${p.id})`).join(" | ")
      : "در حال حاضر ملکی مطابق این معیارها موجود نیست.";
    return { toolCallId: tc.id, result: summary };
  }

  if (tc.function.name === "search_knowledge_base") {
    if (!agent) return { toolCallId: tc.id, result: "ایجنت یافت نشد" };
    const { query } = args as { query?: string };
    const terms = String(query || "").split(/\s+/).filter((w) => w.length > 1);
    // No FTS/vector index for this yet — SQLite LIKE per term is plenty at
    // knowledge-base scale (a few dozen entries per agent, not thousands).
    const entries = await prisma.voiceKnowledgeBase.findMany({
      where: {
        userId: agent.userId,
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
    const scheduledAt = scheduledAtIso ? new Date(scheduledAtIso) : null;
    if (!leadName || !leadPhone || !scheduledAt || isNaN(scheduledAt.getTime())) {
      return { toolCallId: tc.id, result: "برای رزرو، نام، شماره تماس و زمان معتبر لازم است." };
    }
    const property = propertyId ? await prisma.property.findUnique({ where: { id: propertyId } }) : null;

    const appointment = await prisma.voiceAppointment.create({
      data: {
        userId: agent.userId,
        agentId: agent.id,
        propertyId: property && property.userId === agent.userId ? property.id : undefined,
        leadName: String(leadName),
        leadPhone: String(leadPhone),
        scheduledAt,
        status: "pending",
        notes: note ? String(note) : undefined,
      },
    });
    return { toolCallId: tc.id, result: `وقت برای ${appointment.scheduledAt.toLocaleString("fa-IR")} ثبت شد و منتظر تأیید کارشناس است.` };
  }

  return { toolCallId: tc.id, result: "ابزار نامعتبر" };
}

async function handleEndOfCall(message: VapiMessage) {
  const agent = await findAgentByAssistantId(message.call?.assistantId);
  if (!agent || !message.call?.id) return;

  const outcome = message.summary?.includes("appointment") ? "appointment_booked" : undefined;
  const callerPhone = message.call.customer?.number || undefined;

  // Best-effort CRM link — never creates a new contact, just attaches to an
  // existing one if the phone number matches. Failures here must never block
  // the call log itself from being written.
  const contactId = await matchCrmContactByPhone(agent.userId, callerPhone).catch(() => null);

  const callLog = await prisma.voiceCallLog.upsert({
    where: { vapiCallId: message.call.id },
    create: {
      userId: agent.userId,
      agentId: agent.id,
      contactId: contactId || undefined,
      vapiCallId: message.call.id,
      callerPhone,
      status: "completed",
      outcome,
      transcript: message.transcript || undefined,
      summary: message.summary || undefined,
      durationSec: message.durationSeconds ? Math.round(message.durationSeconds) : undefined,
      recordingUrl: message.recordingUrl || undefined,
      cost: message.cost,
      endedAt: new Date(),
    },
    update: {
      contactId: contactId || undefined,
      status: "completed",
      outcome,
      transcript: message.transcript || undefined,
      summary: message.summary || undefined,
      durationSec: message.durationSeconds ? Math.round(message.durationSeconds) : undefined,
      recordingUrl: message.recordingUrl || undefined,
      cost: message.cost,
      endedAt: new Date(),
    },
  });

  // Surface the call in the matched contact's CRM activity timeline.
  if (contactId) {
    await prisma.crmActivity.create({
      data: {
        userId: agent.userId,
        contactId,
        type: "call",
        content: message.summary || `تماس صوتی ${agent.name} — ${callLog.durationSec ? `${callLog.durationSec} ثانیه` : "بدون جزئیات مدت زمان"}${outcome ? ` — نتیجه: ${outcome}` : ""}`,
      },
    }).catch(() => {});
  }

  notify(agent.userId, {
    type: "voice_call",
    title: `تماس پایان یافت: ${agent.name}`,
    body: callLog.summary || (callLog.durationSec ? `مدت تماس: ${callLog.durationSec} ثانیه` : undefined),
    link: "/voice-agent",
  }).catch(() => {});
}
