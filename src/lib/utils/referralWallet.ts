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

/** Every successful purchase earns one commission; the signup credit bonus remains one-time. */
export async function grantReferralRewardInTransaction(tx: import("@prisma/client").Prisma.TransactionClient,referredUserId:string,referrerId:string,bonus:number,amount:number,paymentId?:string):Promise<{commissionToman:number}>{
 if(referredUserId===referrerId||!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(bonus)||bonus<0)throw Error("INVALID_REFERRAL_REWARD");
 if(!paymentId)throw Error("INVALID_REFERRAL_PAYMENT");
 const payment=await tx.payment.findUnique({where:{id:paymentId},select:{userId:true,status:true,amount:true}});
 if(!payment||payment.userId!==referredUserId||payment.status!=="SUCCESS"||payment.amount!==amount)throw Error("INVALID_REFERRAL_PAYMENT");
 const buyer=await tx.user.findUnique({where:{id:referredUserId},select:{referredBy:true}});
 if(buyer?.referredBy!==referrerId)throw Error("INVALID_REFERRAL_OWNER");
 if(await tx.walletTransaction.findFirst({where:{type:"commission",relatedPaymentId:paymentId}}))return {commissionToman:0};
 const referrer=await tx.user.findUniqueOrThrow({where:{id:referrerId},select:{commissionPercentOverride:true}});
 const setting=await tx.siteSetting.findUnique({where:{key:"referral_commission_percent"}});
 const percent=referrer.commissionPercentOverride??Number(setting?.value??15);
 if(!Number.isFinite(percent)||percent<0||percent>100)throw Error("INVALID_COMMISSION");
 const commissionToman=Math.round(amount*percent/100);
 await tx.walletTransaction.create({data:{id:"referral-commission-"+paymentId,userId:referrerId,type:"commission",amount:commissionToman,relatedUserId:referredUserId,relatedPaymentId:paymentId,note:`${percent}% commission on successful purchase`}});
 await tx.user.update({where:{id:referrerId},data:{walletBalance:{increment:commissionToman}}});
 await tx.user.updateMany({where:{id:referredUserId,referralRewarded:false},data:{referralRewarded:true,credits:{increment:bonus}}});
 return {commissionToman};
}
export async function grantReferralReward(referredUserId:string,referrerId:string,bonus:number,amount:number,paymentId?:string){return prisma.$transaction(tx=>grantReferralRewardInTransaction(tx,referredUserId,referrerId,bonus,amount,paymentId));}
