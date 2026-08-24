export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getReferralCommissionPercent } from "@/lib/utils/referralWallet";

async function checkAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [balanceAgg, commissionAgg, pendingPayoutAgg, paidPayoutAgg, commissionPercent] = await Promise.all([
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
    prisma.walletTransaction.aggregate({ where: { type: "commission" }, _sum: { amount: true } }),
    prisma.walletPayoutRequest.aggregate({ where: { status: "pending" }, _sum: { amount: true }, _count: true }),
    prisma.walletPayoutRequest.aggregate({ where: { status: "paid" }, _sum: { amount: true }, _count: true }),
    getReferralCommissionPercent(),
  ]);

  return NextResponse.json({
    commissionPercent,
    totalOutstandingWalletBalance: balanceAgg._sum.walletBalance || 0,
    totalCommissionGranted: commissionAgg._sum.amount || 0,
    pendingPayouts: { count: pendingPayoutAgg._count, total: pendingPayoutAgg._sum.amount || 0 },
    paidPayouts: { count: paidPayoutAgg._count, total: paidPayoutAgg._sum.amount || 0 },
  });
}
