export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { hasVoiceAccess } from "@/lib/voice/workspace";
import { createOutboundCall, VapiNotConfiguredError } from "@/lib/voice/vapiClient";

/**
 * Triggers an outbound call from one of the workspace owner's provisioned
 * Voice Agents to a CRM contact's phone number — the "Call via Voice Agent"
 * button on the contact detail view. Uses the first active, provisioned
 * (has a Vapi assistant + phone number) agent unless agentId is given
 * explicitly.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const ws = await resolveCrmWorkspace(user.id);
  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { voicePlan: true, voicePlanExpiry: true } });
  if (!owner || !hasVoiceAccess(owner)) {
    return NextResponse.json({ error: "افزونه Voice Agent برای این کسب‌وکار فعال نیست." }, { status: 402 });
  }

  const { contactId, agentId } = await req.json().catch(() => ({}));
  if (!contactId) return NextResponse.json({ error: "شناسه مخاطب الزامی است" }, { status: 400 });

  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } });
  if (!contact || contact.userId !== ws.workspaceUserId) {
    return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  }
  if (!contact.phone) {
    return NextResponse.json({ error: "این مخاطب شماره تلفن ثبت‌شده ندارد" }, { status: 400 });
  }

  const agent = agentId
    ? await prisma.voiceAgent.findUnique({ where: { id: agentId } })
    : await prisma.voiceAgent.findFirst({
        where: { userId: ws.workspaceUserId, isActive: true, vapiAssistantId: { not: null }, vapiPhoneNumberId: { not: null } },
        orderBy: { createdAt: "asc" },
      });

  if (!agent || agent.userId !== ws.workspaceUserId) {
    return NextResponse.json({ error: "ایجنت صوتی نامعتبر است" }, { status: 400 });
  }
  if (!agent.vapiAssistantId || !agent.vapiPhoneNumberId) {
    return NextResponse.json({ error: "ابتدا یک ایجنت صوتی را به شماره تلفن متصل کنید (تب ایجنت صوتی)." }, { status: 400 });
  }

  try {
    const call = await createOutboundCall(agent.vapiAssistantId, agent.vapiPhoneNumberId, contact.phone);
    await prisma.voiceCallLog.create({
      data: {
        userId: ws.workspaceUserId,
        agentId: agent.id,
        contactId: contact.id,
        vapiCallId: call.id,
        callerPhone: contact.phone,
        direction: "outbound",
        status: "in_progress",
      },
    });
    return NextResponse.json({ ok: true, callId: call.id });
  } catch (e) {
    if (e instanceof VapiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "خطای نامشخص در برقراری تماس";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
