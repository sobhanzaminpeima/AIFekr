import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { referralCode: true },
  });

  const invited = await prisma.user.count({ where: { referredBy: auth.id } });
  const rewarded = await prisma.user.count({ where: { referredBy: auth.id, referralRewarded: true } });

  return NextResponse.json({
    referralCode: user?.referralCode ?? null,
    invitedCount: invited,
    creditsEarned: rewarded * REFERRAL_BONUS_CREDITS,
    bonusPerReferral: REFERRAL_BONUS_CREDITS,
  });
}
