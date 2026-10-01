export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getPlanLimits } from "@/lib/utils/planLimits";
import { getCreditCosts } from "@/lib/utils/creditCosts";

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
  const scope = searchParams.get("scope") === "student" ? "student" : "all";
  const usageWhere = { createdAt: { gte: since }, ...(scope === "student" ? { type: "chat", metadata: { contains: '"feature":"student"' } } : {}) };

  try {
    const [byType, byModel, dailySeries, distinctUsers, totalCalls, totalTokensRow, missingTokenCount, planLimits, creditCosts] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ["type"],
        where: usageWhere,
        _count: { _all: true },
        _sum: { tokens: true, credits: true },
      }),
      prisma.usageLog.groupBy({
        by: ["model"],
        where: { ...usageWhere, model: { not: null } },
        _count: { _all: true },
        _sum: { tokens: true },
      }),
      prisma.$queryRaw<{ day: string; calls: bigint; tokens: bigint | number | null }[]>`
        SELECT date(createdAt / 1000, 'unixepoch') as day, COUNT(*) as calls, SUM(tokens) as tokens
        FROM UsageLog
        WHERE createdAt >= ${since.getTime()}
          AND (${scope === "student" ? 1 : 0} = 0 OR metadata LIKE ${'%"feature":"student"%'})
        GROUP BY day
        ORDER BY day
      `,
      prisma.usageLog.findMany({
        where: usageWhere,
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.usageLog.count({ where: usageWhere }),
      prisma.usageLog.aggregate({ where: usageWhere, _sum: { tokens: true } }),
      prisma.usageLog.count({ where: { ...usageWhere, tokens: null } }),
      getPlanLimits(),
      getCreditCosts(),
    ]);

    return NextResponse.json({
      days,
      scope,
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
        // SQLite's raw-query driver returns SUM()/COUNT() over INTEGER
        // columns as BigInt when the underlying values are non-null — same
        // reason `calls` needs the cast above. JSON.stringify throws on a
        // raw BigInt (NextResponse.json would 500), so this must be
        // converted before it ever reaches the response.
        tokens: typeof r.tokens === "bigint" ? Number(r.tokens) : (r.tokens ?? 0),
      })),
      planLimits,
      creditCosts,
    });
  } catch (e) {
    console.error("admin usage API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
