export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const appointments = await prisma.voiceAppointment.findMany({
    where: { userId: user.id },
    orderBy: { scheduledAt: "asc" },
    take: 300,
    include: { agent: { select: { name: true } }, property: { select: { title: true, address: true } } },
  });
  return NextResponse.json({ appointments });
}
