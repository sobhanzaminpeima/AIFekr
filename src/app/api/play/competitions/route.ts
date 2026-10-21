export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import {playAccess} from "@/lib/play/service";
import {ensurePlayChallenges} from "@/lib/play/challenges";
export async function GET(req: NextRequest) {
  const u = await requireAuth(req);
  if (!u) return unauthorizedResponse(req);
  try{await playAccess(u.id);await ensurePlayChallenges();}catch{return NextResponse.json({error:"PLAY_UNAVAILABLE"},{status:503});}
  return NextResponse.json({
    tournaments: await prisma.playTournament.findMany({
      where: { status: { in: ["PUBLISHED", "CLOSED", "APPROVED"] } },
      orderBy: { startsAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        gameSlug: true,
        status: true,
        startsAt: true,
        endsAt: true,
        maxAttempts: true,
        rewardTitle: true,
        terms: true,
      },
    }),
    rewards: await prisma.playRewardGrant.findMany({
      where: { userId: u.id },
      select: { id: true, title: true, status: true, fulfilledAt: true },
    }),
  });
}
