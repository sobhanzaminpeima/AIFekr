export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/** Owner revokes a pending invite. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const team = await prisma.team.findUnique({ where: { ownerId: user.id } });
  if (!team) return NextResponse.json({ error: "شما مالک هیچ تیمی نیستید" }, { status: 403 });

  await prisma.teamInvite.updateMany({
    where: { id: params.id, teamId: team.id, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  return NextResponse.json({ success: true });
}
