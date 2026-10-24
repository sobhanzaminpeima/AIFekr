/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const { requireAuth } = await import("@/lib/auth/middleware");
    const user = await requireAuth(req);
    return user ? forbiddenResponse(req) : unauthorizedResponse(req);
  }

  const { searchParams } = new URL(req.url);
  const hours = Math.min(Number(searchParams.get("hours") || 24), 168); // max 7 days
  const since = new Date(Date.now() - hours * 3_600_000);

  try {
    const [recentLogs, totalCount, byFromProvider, byCategory] = await Promise.all([
      // Last 50 individual events
      prisma.providerFallbackLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // Total fallbacks in window
      prisma.providerFallbackLog.count({
        where: { createdAt: { gte: since } },
      }),

      // Group by fromProvider
      prisma.$queryRaw<{ fromProvider: string; count: bigint | number }[]>`
        SELECT fromProvider, COUNT(*) as count
        FROM ProviderFallbackLog
        WHERE createdAt >= ${since.toISOString()}
        GROUP BY fromProvider
        ORDER BY count DESC
      `,

      // Group by category
      prisma.$queryRaw<{ category: string; count: bigint | number }[]>`
        SELECT category, COUNT(*) as count
        FROM ProviderFallbackLog
        WHERE createdAt >= ${since.toISOString()}
        GROUP BY category
        ORDER BY count DESC
      `,
    ]);

    return NextResponse.json({
      totalCount,
      hours,
      recentLogs,
      byFromProvider: byFromProvider.map((r) => ({
        fromProvider: r.fromProvider,
        count: typeof r.count === "bigint" ? Number(r.count) : r.count,
      })),
      byCategory: byCategory.map((r) => ({
        category: r.category,
        count: typeof r.count === "bigint" ? Number(r.count) : r.count,
      })),
    });
  } catch (e) {
    console.error("provider-fallback API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
