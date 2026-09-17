export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getWalletBalances } from "@/lib/utils/teamCredits";

/**
 * Phase 4 of the monetization overhaul: the user-facing "Usage & Credits"
 * dashboard the master prompt calls for. Reuses data that already exists
 * from Phase 1 (UsageLog's per-request breakdown) and Phase 2 (the three
 * wallets) rather than tracking anything new -- this route is a read-only
 * aggregation, not a new source of truth.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [wallets, byType] = await Promise.all([
    getWalletBalances(user.id),
    prisma.usageLog.groupBy({
      by: ["type"],
      where: { userId: user.id, createdAt: { gte: since } },
      _sum: { credits: true, estimatedCostUsd: true },
      _count: { _all: true },
    }),
  ]);

  const breakdown = byType
    .map((row) => ({
      type: row.type,
      count: row._count._all,
      creditsSpent: row._sum.credits || 0,
      estimatedCostUsd: row._sum.estimatedCostUsd || 0,
    }))
    .sort((a, b) => b.creditsSpent - a.creditsSpent);

  const totalCreditsSpent30d = breakdown.reduce((sum, row) => sum + row.creditsSpent, 0);

  return NextResponse.json({ wallets, breakdown, totalCreditsSpent30d, sinceIso: since.toISOString() });
}
