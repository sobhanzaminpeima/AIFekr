export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { removeTeamSeatAndResetPlan } from "@/lib/repositories/userRepository";

/**
 * Removes a seat from a team. An owner can remove any member; a member can
 * only remove themselves (i.e. leave the team). The owner cannot be removed
 * this way — they'd need to transfer ownership or delete the team.
 */
export async function DELETE(req: NextRequest, { params }: { params: { userId: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const membership = await prisma.teamMember.findUnique({ where: { userId: params.userId } });
  if (!membership) return NextResponse.json({ error: "این کاربر عضو تیمی نیست" }, { status: 404 });

  const team = await prisma.team.findUnique({ where: { id: membership.teamId } });
  if (!team) return NextResponse.json({ error: "تیم یافت نشد" }, { status: 404 });

  const isOwner = team.ownerId === user.id;
  const isSelf = params.userId === user.id;
  if (!isOwner && !isSelf) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  if (params.userId === team.ownerId) {
    return NextResponse.json({ error: "مالک تیم قابل حذف نیست" }, { status: 400 });
  }

  await removeTeamSeatAndResetPlan(params.userId);

  return NextResponse.json({ success: true });
}
