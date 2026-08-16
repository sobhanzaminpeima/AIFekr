export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/resend";
import { getServerLang } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const lang = await getServerLang();
  const { contactId, message } = await req.json();
  if (!contactId || !message?.trim()) {
    return NextResponse.json({ error: lang === "fa" ? "مخاطب و متن پیام الزامی است" : "Contact and message are required" }, { status: 400 });
  }

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId } });
  if (!contact) return NextResponse.json({ error: lang === "fa" ? "مخاطب یافت نشد" : "Contact not found" }, { status: 404 });
  if (!contact.email) {
    return NextResponse.json({ error: lang === "fa" ? "این مخاطب ایمیل ندارد" : "This contact has no email address" }, { status: 400 });
  }

  const subject = lang === "fa" ? `پیگیری از طرف تیم فروش` : `Following up`;
  const html = `<div dir="${lang === "fa" ? "rtl" : "ltr"}" style="font-family:Tahoma,Arial,sans-serif;padding:20px;line-height:1.7;">
    <p>${lang === "fa" ? `سلام ${contact.name}،` : `Hi ${contact.name},`}</p>
    <p>${message.trim()}</p>
  </div>`;

  const ok = await sendEmail(contact.email, subject, html);
  if (!ok) return NextResponse.json({ error: lang === "fa" ? "ارسال ایمیل ناموفق بود" : "Failed to send email" }, { status: 502 });

  await prisma.crmActivity.create({
    data: { userId: ws.workspaceUserId, contactId: contact.id, type: "email", content: message.trim() },
  });

  return NextResponse.json({ success: true });
}
