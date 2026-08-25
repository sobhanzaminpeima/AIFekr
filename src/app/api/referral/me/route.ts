import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";
import { getReferralCommissionPercent } from "@/lib/utils/referralWallet";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  const [user, invitedUsers, walletEarnedAgg, commissionPercent] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.id }, select: { referralCode: true, walletBalance: true } }),
    prisma.user.findMany({
      where: { referredBy: auth.id },
      select: { id: true, name: true, email: true, referralRewarded: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    // Referrer reward is now a wallet commission (% of the referred user's
    // purchase), not a flat credit grant — sum the actual commission entries
    // rather than multiplying a fixed bonus by the reward count.
    prisma.walletTransaction.aggregate({ where: { userId: auth.id, type: "commission" }, _sum: { amount: true } }),
    getReferralCommissionPercent(auth.id),
  ]);

  return NextResponse.json({
    referralCode: user?.referralCode ?? null,
    invitedCount: invitedUsers.length,
    walletBalance: user?.walletBalance || 0,
    walletEarnedTotal: walletEarnedAgg._sum.amount || 0,
    commissionPercent,
    bonusPerReferral: REFERRAL_BONUS_CREDITS,
    invitedUsers: invitedUsers.map((u) => ({
      name: u.name,
      email: u.email,
      rewarded: u.referralRewarded,
      createdAt: u.createdAt,
    })),
  });
}
