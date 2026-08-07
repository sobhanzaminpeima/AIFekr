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

  const invitedUsers = await prisma.user.findMany({
    where: { referredBy: auth.id },
    select: { id: true, name: true, email: true, referralRewarded: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const rewarded = invitedUsers.filter((u) => u.referralRewarded).length;

  return NextResponse.json({
    referralCode: user?.referralCode ?? null,
    invitedCount: invitedUsers.length,
    creditsEarned: rewarded * REFERRAL_BONUS_CREDITS,
    bonusPerReferral: REFERRAL_BONUS_CREDITS,
    invitedUsers: invitedUsers.map((u) => ({
      name: u.name,
      email: u.email,
      rewarded: u.referralRewarded,
      createdAt: u.createdAt,
    })),
  });
}
