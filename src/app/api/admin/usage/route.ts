export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getPlanLimits } from "@/lib/utils/planLimits";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const { requireAuth } = await import("@/lib/auth/middleware");
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") || 30), 90);
  const since = new Date(Date.now() - days * 86_400_000);

  try {
    const [byType, byModel, dailySeries, distinctUsers, totalCalls, totalTokensRow, missingTokenCount, planLimits] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ["type"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { tokens: true, credits: true },
      }),
      prisma.usageLog.groupBy({
        by: ["model"],
        where: { createdAt: { gte: since }, model: { not: null } },
        _count: { _all: true },
        _sum: { tokens: true },
      }),
      prisma.$queryRaw<{ day: string; calls: bigint; tokens: number | null }[]>`
        SELECT date(createdAt / 1000, 'unixepoch') as day, COUNT(*) as calls, SUM(tokens) as tokens
        FROM UsageLog
        WHERE createdAt >= ${since.getTime()}
        GROUP BY day
        ORDER BY day
      `,
      prisma.usageLog.findMany({
        where: { createdAt: { gte: since } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.usageLog.count({ where: { createdAt: { gte: since } } }),
      prisma.usageLog.aggregate({ where: { createdAt: { gte: since } }, _sum: { tokens: true } }),
      prisma.usageLog.count({ where: { createdAt: { gte: since }, tokens: null } }),
      getPlanLimits(),
    ]);

    return NextResponse.json({
      days,
      totalCalls,
      totalTokens: totalTokensRow._sum.tokens ?? 0,
      missingTokenCount, // calls where tokens weren't recorded (older rows, or providers that don't report usage)
      distinctUsers: distinctUsers.length,
      byType: byType.map((r) => ({
        type: r.type,
        calls: r._count._all,
        tokens: r._sum.tokens ?? 0,
        credits: r._sum.credits ?? 0,
      })),
      byModel: byModel.map((r) => ({
        model: r.model,
        calls: r._count._all,
        tokens: r._sum.tokens ?? 0,
      })),
      dailySeries: dailySeries.map((r) => ({
        day: r.day,
        calls: typeof r.calls === "bigint" ? Number(r.calls) : r.calls,
        tokens: r.tokens ?? 0,
      })),
      planLimits,
    });
  } catch (e) {
    console.error("admin usage API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
