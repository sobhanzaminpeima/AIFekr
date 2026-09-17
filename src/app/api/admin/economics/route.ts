export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getFxRates } from "@/lib/utils/currency";

/**
 * Phase 5 of the monetization overhaul: Unit Economics + a first pass at
 * Customer Economics red-flag detection, for the admin panel. Both are pure
 * aggregations over data Phases 0-1 already produce (UsageLog.estimatedCostUsd
 * for real AI spend, Payment.amount for revenue) -- no new tracking added.
 *
 * Deliberately NOT built here (real gaps, scoped out): a Revenue Simulator
 * (a forward-looking "what if we changed price X" model) and admin-editable
 * per-feature Credit Rules (CREDIT_COSTS is still a hardcoded constant in
 * credits.ts) -- both are separate, larger pieces of work, not read-only
 * aggregation like this route.
 */
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
    const [costByProvider, totalCostRow, revenueRows, fx, perUserCost] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ["provider"],
        where: { createdAt: { gte: since }, provider: { not: null }, estimatedCostUsd: { not: null } },
        _sum: { estimatedCostUsd: true },
        _count: { _all: true },
      }),
      prisma.usageLog.aggregate({
        where: { createdAt: { gte: since }, estimatedCostUsd: { not: null } },
        _sum: { estimatedCostUsd: true },
      }),
      // amount is stored Toman-equivalent regardless of gateway (see Payment
      // schema comment / payment/create route) so this sum needs one FX
      // conversion, not a per-gateway branch.
      prisma.payment.aggregate({
        where: { createdAt: { gte: since }, status: "SUCCESS" },
        _sum: { amount: true },
      }),
      getFxRates(),
      prisma.usageLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: since }, estimatedCostUsd: { not: null } },
        _sum: { estimatedCostUsd: true },
      }),
    ]);

    const totalCostUsd = totalCostRow._sum.estimatedCostUsd ?? 0;
    const revenueToman = revenueRows._sum.amount ?? 0;
    const revenueUsd = fx.usdToToman > 0 ? revenueToman / fx.usdToToman : 0;
    const grossMarginPct = revenueUsd > 0 ? ((revenueUsd - totalCostUsd) / revenueUsd) * 100 : null;

    // Red flag: a user whose AI cost this period, converted to Toman, exceeds
    // what a FREE-plan signup could plausibly be worth -- a rough, explainable
    // threshold ($5 of real provider cost) rather than a per-plan revenue
    // lookup, since a single user's actual revenue contribution over an
    // arbitrary window isn't reliably attributable to one payment record.
    const RED_FLAG_USD_THRESHOLD = 5;
    const redFlagUserIds = perUserCost
      .filter((row) => (row._sum.estimatedCostUsd ?? 0) >= RED_FLAG_USD_THRESHOLD)
      .sort((a, b) => (b._sum.estimatedCostUsd ?? 0) - (a._sum.estimatedCostUsd ?? 0))
      .slice(0, 20);

    const redFlagUsers = redFlagUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: redFlagUserIds.map((r) => r.userId) } },
          select: { id: true, name: true, email: true, plan: true },
        })
      : [];
    const redFlagById = new Map(redFlagUsers.map((u) => [u.id, u]));

    return NextResponse.json({
      days,
      totalCostUsd,
      revenueUsd,
      grossMarginPct,
      usdToToman: fx.usdToToman,
      byProvider: costByProvider
        .map((row) => ({ provider: row.provider, costUsd: row._sum.estimatedCostUsd ?? 0, calls: row._count._all }))
        .sort((a, b) => b.costUsd - a.costUsd),
      redFlagUsers: redFlagUserIds.map((row) => ({
        userId: row.userId,
        costUsd: row._sum.estimatedCostUsd ?? 0,
        user: redFlagById.get(row.userId) ?? null,
      })),
    });
  } catch (e) {
    console.error("admin economics API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
