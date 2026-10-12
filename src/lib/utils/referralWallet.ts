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
 * referrer's wallet commission atomically. The database claims the
 * first-purchase reward, so stale callback data cannot grant it twice.
 */
export async function grantReferralReward(
  referredUserId: string,
  referrerId: string,
  referredUserBonusCredits: number,
  paymentAmountToman: number,
  paymentId?: string
): Promise<{ commissionToman: number }> {
  if (referredUserId === referrerId || !Number.isSafeInteger(paymentAmountToman) || paymentAmountToman < 0 || !Number.isSafeInteger(referredUserBonusCredits) || referredUserBonusCredits < 0) throw new Error("INVALID_REFERRAL_REWARD");
  const percent = await getReferralCommissionPercent(referrerId);
  const commissionToman = Math.round((paymentAmountToman * percent) / 100);

  return prisma.$transaction(async tx => {
    if (paymentId) {
      const payment = await tx.payment.findUnique({where:{id:paymentId},select:{userId:true,status:true,amount:true}});
      if (!payment || payment.userId !== referredUserId || payment.status !== "SUCCESS" || payment.amount !== paymentAmountToman) throw new Error("INVALID_REFERRAL_PAYMENT");
    }
    const claimed = await tx.user.updateMany({
      where: { id: referredUserId, referredBy: referrerId, referralRewarded: false },
      data: { credits: { increment: referredUserBonusCredits }, referralRewarded: true },
    });
    if (!claimed.count) return {commissionToman:0};
    await tx.user.update({
      where: { id: referrerId },
      data: { walletBalance: { increment: commissionToman } },
    });
    await tx.walletTransaction.create({
      data: {
        userId: referrerId,
        type: "commission",
        amount: commissionToman,
        relatedUserId: referredUserId,
        relatedPaymentId: paymentId,
        note: `${percent}% کمیسیون از خرید کاربر دعوت‌شده`,
      },
    });
    return {commissionToman};
  });
}
