export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, businessFilter } from "@/lib/crm/workspace";
import { hasVoiceAccess } from "@/lib/voice/workspace";
import { createOutboundCall, VapiNotConfiguredError, VapiRejectedError } from "@/lib/voice/vapiClient";
import { reserveVoiceCall, settleVoiceCall } from "@/lib/voice/billing";
import { voiceSettings } from "@/lib/voice/settings";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/**
 * Triggers an outbound call from one of the workspace owner's provisioned
 * Voice Agents to a CRM contact's phone number — the "Call via Voice Agent"
 * button on the contact detail view. Uses the first active, provisioned
 * (has a Vapi assistant + phone number) agent unless agentId is given
 * explicitly.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { voicePlan: true, voicePlanExpiry: true,plan:true,planExpiry:true,trialEndsAt:true } });
  if (!owner || !hasVoiceAccess(owner)) {
    return NextResponse.json({ error: tri(lang, "افزونه Voice Agent برای این کسب‌وکار فعال نیست.", "The Voice Agent add-on is not enabled for this business.", "Das Voice-Agent-Add-on ist für dieses Unternehmen nicht aktiviert.") }, { status: 402 });
  }

  const { contactId, agentId } = await req.json().catch(() => ({}));
  if (typeof contactId!=="string" || !contactId || (agentId!==undefined&&typeof agentId!=="string")) return NextResponse.json({ error: tri(lang, "شناسه مخاطب الزامی است", "Contact ID is required", "Kontakt-ID ist erforderlich") }, { status: 400 });

  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } });
  // An AI call may only be placed to a contact of the ACTIVE business, never to a sibling business's.
  if (!contact || contact.userId !== ws.workspaceUserId || contact.businessId !== (ws.businessId || null)) {
    return NextResponse.json({ error: tri(lang, "مخاطب یافت نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });
  }
  if (!contact.phone) {
    return NextResponse.json({ error: tri(lang, "این مخاطب شماره تلفن ثبت‌شده ندارد", "This contact has no phone number on file", "Für diesen Kontakt ist keine Telefonnummer hinterlegt") }, { status: 400 });
  }

  const agent = agentId
    ? await prisma.voiceAgent.findUnique({ where: { id: agentId } })
    : await prisma.voiceAgent.findFirst({
        where: { userId: ws.workspaceUserId, ...businessFilter(ws), isActive: true, vapiAssistantId: { not: null }, vapiPhoneNumberId: { not: null } },
        orderBy: { createdAt: "asc" },
      });

  if (!agent || !agent.isActive || agent.userId !== ws.workspaceUserId || agent.businessId !== (ws.businessId || null)) {
    return NextResponse.json({ error: tri(lang, "ایجنت صوتی نامعتبر است", "Invalid voice agent", "Ungültiger Voice Agent") }, { status: 400 });
  }
  if (!agent.vapiAssistantId || !agent.vapiPhoneNumberId) {
    return NextResponse.json({ error: tri(lang, "ابتدا یک ایجنت صوتی را به شماره تلفن متصل کنید (تب ایجنت صوتی).", "First connect a voice agent to a phone number (Voice Agent tab).", "Verbinden Sie zuerst einen Voice Agent mit einer Telefonnummer (Tab Voice Agent).") }, { status: 400 });
  }

  const number=contact.phone.startsWith("09") ? `+98${contact.phone.slice(1)}` : contact.phone.replace(/[\s()-]/g,"");
  if(!/^\+[1-9]\d{6,14}$/.test(number)) return NextResponse.json({error:"شمارهٔ مخاطب باید همراه کد کشور باشد."},{status:400});
  const settings=await voiceSettings();
  let reservation;
  try { reservation=await reserveVoiceCall(agent,null,settings.creditsPerMinute,settings.maxDurationSeconds,"outbound",contact.id,number); }
  catch { return NextResponse.json({error:"کریدت کافی نیست یا تماس قبلی با این مخاطب هنوز در حال انجام است."},{status:402}); }
  let providerAccepted=false;
  try {
    const call = await createOutboundCall(agent.vapiAssistantId, agent.vapiPhoneNumberId, number, reservation.id);
    providerAccepted=true;
    await prisma.voiceCallLog.update({where:{id:reservation.id},data:{vapiCallId:call.id}});
    return NextResponse.json({ ok: true, callId: call.id });
  } catch (e) {
    if(!providerAccepted&&(e instanceof VapiRejectedError||e instanceof VapiNotConfiguredError)) await settleVoiceCall(reservation.id,0,{status:"failed"});
    else await prisma.voiceCallLog.updateMany({where:{id:reservation.id,billingStatus:"pending"},data:{status:"awaiting_report"}});
    if (e instanceof VapiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = tri(lang, "تماس انجام نشد؛ تنظیمات و موجودی Vapi را بررسی کنید.", "Call failed. Check Vapi configuration and balance.", "Anruf fehlgeschlagen. Vapi-Konfiguration und Guthaben prüfen.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
