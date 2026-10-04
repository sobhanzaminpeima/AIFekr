export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/resend";

const INVITE_EXPIRY_DAYS = 7;

/** Owner invites a new seat by email. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const team = await prisma.team.findUnique({
    where: { ownerId: user.id },
    include: { members: true, invites: { where: { status: "PENDING" } } },
  });
  if (!team) return NextResponse.json({ error: "شما مالک هیچ تیمی نیستید" }, { status: 403 });

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "ایمیل الزامی است" }, { status: 400 });

  const takenSeats = team.members.length + team.invites.length;
  if (takenSeats >= team.maxSeats) {
    return NextResponse.json({ error: `ظرفیت تیم پر است (حداکثر ${team.maxSeats} نفر)` }, { status: 400 });
  }

  const alreadyMember = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (alreadyMember) {
    const existingMembership = await prisma.teamMember.findUnique({ where: { userId: alreadyMember.id } });
    if (existingMembership) {
      return NextResponse.json({ error: "این کاربر از قبل عضو یک تیم است" }, { status: 400 });
    }
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 3_600_000);

  const invite = await prisma.teamInvite.create({
    data: { teamId: team.id, email: email.trim(), token, invitedBy: user.id, expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const acceptUrl = `${appUrl}/team/accept?token=${token}`;

  await sendEmail(
    email.trim(),
    `دعوت به تیم «${team.name}» در AiFekr`,
    `<div dir="rtl" style="font-family:Tahoma;padding:24px;">
      <h2>دعوت به تیم</h2>
      <p>${user.name || "یکی از اعضا"} شما را به تیم «${team.name}» در AiFekr دعوت کرده است.</p>
      <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:white;border-radius:8px;text-decoration:none;">
        پذیرش دعوت
      </a>
      <p style="color:#888;font-size:12px;margin-top:16px;">این دعوت تا ${INVITE_EXPIRY_DAYS} روز دیگر معتبر است.</p>
    </div>`
  ).catch(console.error);

  return NextResponse.json({ success: true, invite: { id: invite.id, email: invite.email, expiresAt: invite.expiresAt } });
}
