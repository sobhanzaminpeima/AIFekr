export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Itemised credit-consumption ledger for the signed-in user.
 *
 * The sibling `/api/user/usage` route only returns 30-day totals grouped by
 * type, and the credits page's "Transactions" list only ever read
 * `/api/user/payments` (purchases). So a user could watch their balance drop
 * by 4 per chat message with nothing anywhere in the product accounting for
 * where it went -- QA report 2026-09-15, finding U06. UsageLog already
 * records every deduction, so this is a read of existing data, not new
 * bookkeeping.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  const entries = await prisma.usageLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, model: true, credits: true, tokens: true, createdAt: true, metadata: true },
  });

  // Tool charges carry the feature id in their metadata; without it the ledger could only say "tool".
  const featureOf = (metadata: string | null): string | null => {
    if (!metadata) return null;
    try { const f = JSON.parse(metadata)?.feature; return typeof f === "string" ? f : null; } catch { return null; }
  };
  return NextResponse.json({ entries: entries.map(({ metadata, ...e }) => ({ ...e, feature: featureOf(metadata) })) });
}
