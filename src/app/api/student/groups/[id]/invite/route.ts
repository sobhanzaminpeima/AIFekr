export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse, isStudentWorkspaceEnabled } from "@/lib/student/access";
import { notify } from "@/lib/notifications/create";
import { sendEmail } from "@/lib/email/resend";
import { rateLimit } from "@/lib/utils/rateLimit";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  if (!rateLimit(`student-group-invite:${user.id}`, 10, 60_000).allowed) return NextResponse.json({ error: "تعداد دعوت‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید" }, { status: 429 });
  let body: { email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const email = body.email?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "ایمیل معتبر وارد کنید" }, { status: 400 });

  const [membership, group, matchingUser] = await Promise.all([
    prisma.studentStudyGroupMember.findUnique({ where: { groupId_userId: { groupId: params.id, userId: user.id } }, select: { id: true } }),
    prisma.studentStudyGroup.findUnique({ where: { id: params.id }, select: { id: true, name: true, inviteCode: true } }),
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE lower(email) = ${email} LIMIT 1`,
  ]);
  if (!group || !membership) return NextResponse.json({ error: "گروه پیدا نشد یا اجازهٔ دعوت ندارید" }, { status: 404 });
  const invitee = matchingUser[0] ? await prisma.user.findUnique({ where: { id: matchingUser[0].id }, select: { id: true, email: true, name: true, isBlocked: true } }) : null;
  if (invitee?.id === user.id) return NextResponse.json({ error: "ایمیل خودتان را نمی‌توانید دعوت کنید" }, { status: 400 });

  let added = false;
  if (invitee) {
    if (invitee.isBlocked || !await isStudentWorkspaceEnabled({ id: invitee.id })) return NextResponse.json({ error: "این حساب در حال حاضر به فضای دانشجویی دسترسی ندارد" }, { status: 409 });
    const existing = await prisma.studentStudyGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: invitee.id } }, select: { id: true } });
    if (existing) return NextResponse.json({ success: true, added: false, alreadyMember: true, emailSent: false, message: "این دانشجو از قبل عضو گروه است" });
    await prisma.studentStudyGroupMember.create({ data: { groupId: group.id, userId: invitee.id } });
    added = true;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com").replace(/\/$/, "");
  const groupName = escapeHtml(group.name);
  const senderName = escapeHtml(user.name || user.email || "یک دانشجو");
  const emailHtml = invitee
    ? `<div dir="rtl" style="font-family:Tahoma,sans-serif;padding:24px"><h2>دعوت به گروه مطالعهٔ AIFekr</h2><p>${senderName} شما را به گروه «${groupName}» اضافه کرد.</p><p>گفتگو و اطلاعات گروه را پس از ورود از اینجا ببینید:</p><a href="${appUrl}/student" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">رفتن به فضای دانشجویی</a></div>`
    : `<div dir="rtl" style="font-family:Tahoma,sans-serif;padding:24px"><h2>دعوت به گروه مطالعهٔ AIFekr</h2><p>${senderName} شما را به گروه «${groupName}» دعوت کرده است.</p><p>پس از ساخت حساب یا ورود به AIFekr، به فضای دانشجویی بروید و کد زیر را در قسمت «پیوستن به گروه با کد دعوت» وارد کنید:</p><p style="font-size:20px;font-weight:bold;letter-spacing:2px">${escapeHtml(group.inviteCode)}</p><a href="${appUrl}/student" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">ورود به AIFekr</a></div>`;
  if (invitee && added) await notify(invitee.id, { type: "student_group_invite", title: "به گروه مطالعه دعوت شدی", body: `به گروه «${group.name}» اضافه شدی.`, link: "/student" });
  const safeSubject = group.name.replace(/[\r\n]/g, " ").slice(0, 80);
  const emailSent = await sendEmail(email, `دعوت به گروه مطالعه «${safeSubject}» در AIFekr`, emailHtml).catch(() => false);
  return NextResponse.json({ success: true, added, alreadyMember: false, emailSent, message: !emailSent ? "عضویت ثبت شد اما ارسال ایمیل ناموفق بود؛ کد دعوت را مستقیم به دانشجو بدهید" : invitee ? "دانشجو اضافه شد و اعلان ایمیلی ارسال شد" : "ایمیل دعوت همراه با کد برای دانشجو ارسال شد" }, { status: 200 });
}
