export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getReferralCommissionPercent } from "@/lib/utils/referralWallet";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const [walletUser, transactions, payoutRequests, commissionPercent] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } }),
    prisma.walletTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.walletPayoutRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    getReferralCommissionPercent(),
  ]);

  return NextResponse.json({
    walletBalance: walletUser?.walletBalance || 0,
    commissionPercent,
    transactions,
    payoutRequests,
  });
}
