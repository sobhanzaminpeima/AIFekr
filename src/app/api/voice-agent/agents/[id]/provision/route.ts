export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hasVoiceAccess } from "@/lib/voice/workspace";
import { upsertVapiAssistant, provisionPhoneNumber, VapiNotConfiguredError } from "@/lib/voice/vapiClient";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { logError } from "@/lib/logging/errorLog";

/**
 * Creates/updates the Vapi assistant for this agent and, on first call,
 * provisions a phone number for it. Idempotent — safe to call again after
 * editing the agent's prompt/voice to push the changes to Vapi.
 *
 * QA 2026-09-15 (U01): connecting a number failed with an unexplained error.
 * Every message here was Persian-only, none said what the prerequisite is,
 * and a provider failure returned Vapi's raw internal text. Each case now
 * says, in the user's language, what is required and what to do next.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();
  if (!hasVoiceAccess(user)) {
    return NextResponse.json({
      error: tri(lang,
        "اتصال به شماره تلفن واقعی نیازمند افزونهٔ Voice Agent است (جدا از پلن اشتراک، از صفحهٔ «پلن‌ها» قابل خرید). ساخت و تست ایجنت بدون شماره رایگان است.",
        "Connecting a real phone number requires the Voice Agent add-on (sold separately from your subscription, on the Plans page). Building and testing an agent without a number is free.",
        "Für eine echte Telefonnummer ist das Voice-Agent-Add-on erforderlich (getrennt vom Abo, auf der Seite „Pläne“). Einen Agenten ohne Nummer erstellen und testen ist kostenlos."),
      code: "voice_addon_required",
    }, { status: 402 });
  }

  const { id } = await params;
  const agent = await prisma.voiceAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== user.id) {
    return NextResponse.json({ error: tri(lang, "ایجنت یافت نشد", "Agent not found", "Agent nicht gefunden") }, { status: 404 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  try {
    const assistant = await upsertVapiAssistant(
      {
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        voiceId: agent.voiceId,
        vertical: agent.vertical,
        serverUrl: `${appUrl}/api/webhooks/vapi`,
      },
      agent.vapiAssistantId
    );

    let phoneNumberId = agent.vapiPhoneNumberId;
    let phoneNumber = agent.phoneNumber;
    if (!phoneNumberId) {
      const provisioned = await provisionPhoneNumber(assistant.id);
      phoneNumberId = provisioned.id;
      phoneNumber = provisioned.number;
    }

    const updated = await prisma.voiceAgent.update({
      where: { id },
      data: { vapiAssistantId: assistant.id, vapiPhoneNumberId: phoneNumberId, phoneNumber },
    });
    return NextResponse.json({ agent: updated });
  } catch (e) {
    if (e instanceof VapiNotConfiguredError) {
      return NextResponse.json({
        error: tri(lang,
          "سرویس تلفن (Vapi) هنوز روی این سرور پیکربندی نشده است. ایجنت ذخیره شد؛ برای فعال‌سازی شماره با پشتیبانی تماس بگیرید.",
          "The phone service (Vapi) isn't configured on this server yet. Your agent is saved — contact support to activate a number.",
          "Der Telefondienst (Vapi) ist auf diesem Server noch nicht konfiguriert. Ihr Agent ist gespeichert — kontaktieren Sie den Support zur Aktivierung einer Nummer."),
        code: "voice_provider_not_configured",
      }, { status: 503 });
    }
    // Vapi's own error text is internal and English-only; log it for the admin
    // error tab and give the user an actionable message with a trace id.
    const requestId = globalThis.crypto.randomUUID().slice(0, 8);
    await logError({ source: "/api/voice-agent/provision", error: e, userId: user.id, requestId });
    return NextResponse.json({
      error: tri(lang,
        `اتصال شماره انجام نشد — ارائه‌دهندهٔ تلفن درخواست را رد کرد. چند دقیقه بعد دوباره تلاش کنید؛ اگر تکرار شد این کد را به پشتیبانی بدهید: ${requestId}`,
        `The number couldn't be connected — the phone provider rejected the request. Try again in a few minutes; if it keeps failing, give support this code: ${requestId}`,
        `Die Nummer konnte nicht verbunden werden — der Telefonanbieter hat die Anfrage abgelehnt. Versuchen Sie es in einigen Minuten erneut; bei wiederholtem Fehler nennen Sie dem Support diesen Code: ${requestId}`),
      requestId,
    }, { status: 502 });
  }
}
