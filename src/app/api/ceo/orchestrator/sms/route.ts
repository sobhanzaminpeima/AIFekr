export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { sendSMS } from "@/lib/sms/smsir";

// Sends a follow-up SMS to one CRM contact. Requires an explicit click per
// message (the frontend "send" button) — this endpoint never fires on its
// own; the CEO orchestrator only ever *drafts* messages for review.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { contactId, message } = await req.json();
  if (!contactId || !message?.trim()) return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });

  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  if (contact.userId !== user.id) return forbiddenResponse();
  if (!contact.phone) return NextResponse.json({ error: "این مخاطب شماره تلفن ندارد" }, { status: 400 });

  const ok = await sendSMS(contact.phone, message.trim());
  if (!ok) return NextResponse.json({ error: "ارسال پیامک ناموفق بود" }, { status: 502 });

  await prisma.crmContact.update({ where: { id: contactId }, data: { lastContact: new Date() } });
  return NextResponse.json({ success: true });
}
