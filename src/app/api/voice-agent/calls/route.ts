export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  const calls = await prisma.voiceCallLog.findMany({
    where: { userId: user.id, ...(agentId ? { agentId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { agent: { select: { name: true } } },
  });
  return NextResponse.json({ calls });
}
