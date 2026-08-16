export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { hasVoiceAccess } from "@/lib/voice/workspace";
import { upsertVapiAssistant, provisionPhoneNumber, VapiNotConfiguredError } from "@/lib/voice/vapiClient";

/**
 * Creates/updates the Vapi assistant for this agent and, on first call,
 * provisions a phone number for it. Idempotent — safe to call again after
 * editing the agent's prompt/voice to push the changes to Vapi.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (!hasVoiceAccess(user)) {
    return NextResponse.json({ error: "برای اتصال به شماره تلفن واقعی، افزونه Voice Agent را فعال کنید." }, { status: 402 });
  }

  const { id } = await params;
  const agent = await prisma.voiceAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== user.id) return NextResponse.json({ error: "ایجنت یافت نشد" }, { status: 404 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  try {
    const assistant = await upsertVapiAssistant(
      {
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        voiceId: agent.voiceId,
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
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "خطای نامشخص در اتصال به Vapi";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
