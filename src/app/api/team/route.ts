export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/** Returns the current user's team (as owner or member), or null if they have none. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
  if (!membership) return NextResponse.json({ team: null });

  const team = await prisma.team.findUnique({
    where: { id: membership.teamId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      invites: { where: { status: "PENDING" } },
    },
  });
  if (!team) return NextResponse.json({ team: null });

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      credits: team.credits,
      maxSeats: team.maxSeats,
      planExpiry: team.planExpiry,
      isOwner: team.ownerId === user.id,
      members: team.members.map((m) => ({ role: m.role, joinedAt: m.joinedAt, ...m.user })),
      invites: team.invites.map((i) => ({ id: i.id, email: i.email, createdAt: i.createdAt, expiresAt: i.expiresAt })),
    },
  });
}

/** Owner can rename their team. */
export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const team = await prisma.team.findUnique({ where: { ownerId: user.id } });
  if (!team) return NextResponse.json({ error: "شما مالک هیچ تیمی نیستید" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "نام تیم الزامی است" }, { status: 400 });

  await prisma.team.update({ where: { id: team.id }, data: { name: name.trim().slice(0, 60) } });
  return NextResponse.json({ success: true });
}
