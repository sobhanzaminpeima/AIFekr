import { changeReferralCode } from "@/lib/utils/changeReferralCode";
import { rateLimit } from "@/lib/utils/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";
import { getReferralCommissionPercent } from "@/lib/utils/referralWallet";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse(req);

  const [user, invitedUsers, walletEarnedAgg, commissionPercent] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.id }, select: { referralCode: true, referralDiscountPercent:true, walletBalance: true } }),
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
    currency: auth.currency ?? null,
    referralCode: user?.referralCode ?? null,
    discountPercent:user?.referralDiscountPercent??0,
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

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse(req);
  if (!rateLimit(`referral-code:${auth.id}`, 10, 60000).allowed) return NextResponse.json({code:"RATE_LIMITED"},{status:429});
  const body = await req.json().catch(() => null);
  try {
    const result = await prisma.$transaction(async tx => {
      const changed = await changeReferralCode(tx, auth.id, body?.code);
      await tx.auditLog.create({ data: { actorId: auth.id, action: "referral_code_changed", targetId: auth.id, metadata: JSON.stringify(changed) } });
      return changed;
    });
    return NextResponse.json({referralCode:result.code});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_CODE") return NextResponse.json({code:message},{status:400});
    if (message === "CODE_UNAVAILABLE" || (error as {code?:string})?.code === "P2002") return NextResponse.json({code:"CODE_UNAVAILABLE"},{status:409});
    console.error("Referral code change failed");
    return NextResponse.json({code:"SERVER_ERROR"},{status:500});
  }
}
