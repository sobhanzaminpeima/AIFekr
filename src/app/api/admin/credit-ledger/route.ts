export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { ledgerDrift } from "@/lib/credits/ledger";

/**
 * Credit ledger reconciliation (read-only): for every wallet, the stored
 * balance against the sum of its ledger rows. `drift` other than 0 means a
 * balance moved without a ledger row, or the opening balance was never
 * recorded (scripts/credit-ledger-opening-balance.cjs). Also the last 30
 * days' credit flow by entry type.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse(req) : unauthorizedResponse(req);
  }
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [all, flow] = await Promise.all([
    ledgerDrift(prisma, { includeEmpty: true }),
    prisma.creditLedgerEntry.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _sum: { delta: true }, _count: { _all: true } }),
  ]);
  const wallets = all.filter((w) => w.entries), unrecorded = all.filter((w) => !w.entries && w.balance !== 0).length;
  const drifting = wallets.filter((w) => w.drift !== 0).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
  return NextResponse.json({
    wallets: wallets.length,
    walletsWithoutLedger: unrecorded,
    drifting: drifting.length,
    totalDrift: drifting.reduce((s, w) => s + w.drift, 0),
    top: drifting.slice(0, 50),
    flow30d: flow.map((r) => ({ type: r.type, entries: r._count._all, credits: r._sum.delta ?? 0 })),
  });
}
