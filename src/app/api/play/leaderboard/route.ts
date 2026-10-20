export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { playAccess } from "@/lib/play/service";
import { gameSlugs } from "@/lib/play/engine";
import { z } from "zod";
export async function GET(req: NextRequest) {
  const u = await requireAuth(req);
  if (!u) return unauthorizedResponse(req);
  try {
    await playAccess(u.id);
    const period = z
        .enum(["daily", "weekly", "monthly", "all"])
        .parse(req.nextUrl.searchParams.get("period") || "all"),
      game = z
        .enum(gameSlugs)
        .optional()
        .parse(req.nextUrl.searchParams.get("game") || undefined),
      since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    if (period === "weekly")
      since.setUTCDate(since.getUTCDate() - ((since.getUTCDay() + 6) % 7));
    if (period === "monthly") since.setUTCDate(1);
    const scores = await prisma.playSession.groupBy({
      by: ["userId"],
      where: {
        status: "ACCEPTED",
        ...(game ? { gameSlug: game } : {}),
        ...(period !== "all" ? { completedAt: { gte: since } } : {}),
        user: { playProfile: { is: { suspended: false } } },
      },
      _sum: { score: true },
      orderBy: [{ _sum: { score: "desc" } }, { userId: "asc" }],
      take: 100,
    });
    const profiles = await prisma.playProfile.findMany({
      where: { userId: { in: scores.map((s) => s.userId) } },
      select: {
        userId: true,
        publicName: true,
        user: { select: { name: true } },
      },
    });
    return NextResponse.json({
      rankings: scores.map((s, i) => {
        const p = profiles.find((p) => p.userId === s.userId);
        return {
          rank: i + 1,
          name: p?.publicName ? p.user.name || "Player" : `Player ${i + 1}`,
          points: s._sum.score || 0,
          mine: s.userId === u.id,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "RANKING_UNAVAILABLE" }, { status: 400 });
  }
}
