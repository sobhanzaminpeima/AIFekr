import { prisma } from "@/lib/db/prisma";

/**
 * Affiliate wallet — a referrer earns a configurable % commission (Toman)
 * of a referred user's purchase, credited to User.walletBalance, instead of
 * the old flat REFERRAL_BONUS_CREDITS reward. The referred user still gets
 * their own flat credit bonus (unchanged) — only the referrer's side moved
 * from platform credits to a real-money wallet.
 */

const DEFAULT_COMMISSION_PERCENT = 15;
const REFERRAL_COMMISSION_SETTING_KEY = "referral_commission_percent";

/**
 * Effective commission percent for a given referrer: their own
 * `commissionPercentOverride` if an admin set one, otherwise the global
 * `referral_commission_percent` site setting, otherwise the hardcoded
 * default. Pass no userId to get just the global/default rate (e.g. for
 * displaying "here's the standard rate" before a user has any referrals).
 */
export async function getReferralCommissionPercent(userId?: string): Promise<number> {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { commissionPercentOverride: true } });
    if (user?.commissionPercentOverride != null && user.commissionPercentOverride >= 0 && user.commissionPercentOverride <= 100) {
      return user.commissionPercentOverride;
    }
  }
  const setting = await prisma.siteSetting.findUnique({ where: { key: REFERRAL_COMMISSION_SETTING_KEY } });
  const parsed = setting ? Number(setting.value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : DEFAULT_COMMISSION_PERCENT;
}

/**
 * Grants the referred user's flat signup bonus (unchanged behavior) and the
 * referrer's wallet commission (new behavior), atomically. Caller is
 * responsible for the `referralRewarded` guard check before calling this —
 * same contract as the old grantReferralBonus() it replaces.
 */
export async function grantReferralReward(
  referredUserId: string,
  referrerId: string,
  referredUserBonusCredits: number,
  paymentAmountToman: number,
  paymentId?: string
): Promise<{ commissionToman: number }> {
  const percent = await getReferralCommissionPercent(referrerId);
  const commissionToman = Math.round((paymentAmountToman * percent) / 100);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: referredUserId },
      data: { credits: { increment: referredUserBonusCredits }, referralRewarded: true },
    }),
    prisma.user.update({
      where: { id: referrerId },
      data: { walletBalance: { increment: commissionToman } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: referrerId,
        type: "commission",
        amount: commissionToman,
        relatedUserId: referredUserId,
        relatedPaymentId: paymentId,
        note: `${percent}% کمیسیون از خرید کاربر دعوت‌شده`,
      },
    }),
  ]);

  return { commissionToman };
}
