export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { acceptTeamInvite } from "@/lib/repositories/userRepository";

/** Currently logged-in user redeems an invite token and joins the team. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "توکن دعوت الزامی است" }, { status: 400 });

  const invite = await prisma.teamInvite.findUnique({ where: { token }, include: { team: { include: { members: true } } } });
  if (!invite || invite.status !== "PENDING") {
    return NextResponse.json({ error: "این دعوت معتبر نیست یا قبلاً استفاده شده است" }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "این دعوت منقضی شده است" }, { status: 400 });
  }
  if (invite.team.members.length >= invite.team.maxSeats) {
    return NextResponse.json({ error: "ظرفیت تیم پر شده است" }, { status: 400 });
  }

  const existingMembership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
  if (existingMembership) {
    return NextResponse.json({ error: "شما از قبل عضو یک تیم هستید" }, { status: 400 });
  }

  await acceptTeamInvite(invite.id, invite.teamId, user.id);

  return NextResponse.json({ success: true, teamId: invite.teamId });
}
