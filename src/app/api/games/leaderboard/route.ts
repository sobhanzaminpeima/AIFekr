export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");

  const where = gameId ? { gameId, status: "completed" } : { status: "completed" };

  const top = await prisma.gameSession.findMany({
    where,
    orderBy: { score: "desc" },
    take: 20,
    select: {
      id: true, score: true, maxScore: true, completedAt: true,
      game: { select: { name: true, slug: true } },
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json({ leaderboard: top });
}
