import {releaseFailedPromotion} from "@/lib/billing/releasePromotion";
import { GROWTH_MODULES, moduleEntry } from "@/lib/growth/modules";
import {publicAppUrl} from "@/lib/utils/publicAppUrl";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPayment } from "@/lib/payment/zarinpal";
import { sendPaymentConfirmEmail } from "@/lib/email/resend";
import { settleVerifiedPayment } from "@/lib/payment/reviewBankPayment";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";
import { findPaymentById, activatePlanForPayment } from "@/lib/repositories/paymentRepository";
import { grantReferralReward } from "@/lib/utils/referralWallet";
import { logError } from "@/lib/logging/errorLog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("Status");
  const authority = searchParams.get("Authority");
  const paymentId = searchParams.get("paymentId");

  const appUrl = publicAppUrl();
  const resultPath=(p:{plan:string;entitlementSnapshot?:string|null})=>{try{const path=JSON.parse(p.entitlementSnapshot||"{}").returnPath;if(["/chat","/fitness/credits","/fitness/marketplace"].includes(path))return path;const mod=GROWTH_MODULES.find(m=>m.paths[0]===path||moduleEntry(m)===path);if(mod)return moduleEntry(mod);}catch{}return p.plan.startsWith("CREDITS_")?"/credits":"/plans";};

  // Credit top-ups redirect back to /credits instead of /plans -- resolved
  // up front from paymentId (works even for the early failure paths, before
  // the row's own `plan` field has been loaded below).
  const failureRedirect = async () => {
    const p = paymentId ? await findPaymentById(paymentId).catch(() => null) : null;
    return `${appUrl}${p?resultPath(p):"/plans"}?payment=failed`;
  };

  if (status !== "OK" || !authority || !paymentId) {
    return NextResponse.redirect(await failureRedirect());
  }

  const payment = await findPaymentById(paymentId);

  if (!payment || payment.gateway !== "zarinpal" || payment.authority !== authority || !["PENDING","SUCCESS"].includes(payment.status)) {
    return NextResponse.redirect(await failureRedirect());
  }

  if(payment.status==="SUCCESS")return NextResponse.redirect(`${appUrl}${resultPath(payment)}?payment=success`);

  const result = await verifyPayment({ authority, amount: payment.amount });

  if (!result.ok) {
    await prisma.payment.updateMany({where:{id:paymentId,status:"PENDING",authority},data:{status:"FAILED"}});
    if(JSON.parse(payment.entitlementSnapshot||"{}").quote?.bonus)await releaseFailedPromotion(paymentId);
    return NextResponse.redirect(await failureRedirect());
  }

  const snapshot=JSON.parse(payment.entitlementSnapshot||"{}");
  if(snapshot.credits!=null){
    const applied=await settleVerifiedPayment(payment.id,authority,result.refId||"");
    if(applied&&payment.user.email)sendPaymentConfirmEmail(payment.user.email,payment.user.name||"کاربر",payment.plan,payment.amount,result.refId||"").catch(err=>logError({source:"/api/payment/verify",error:err,userId:payment.userId}));
    return NextResponse.redirect(`${appUrl}${resultPath(payment)}?payment=success&ref=${result.refId}`);
  }

  // Success — activate plan. TEAM credits are pooled on a Team row, not on
  // User.credits directly — see src/lib/utils/teamCredits.ts.
  // Credit top-up purchases dispatch on the "CREDITS_<tierId>" prefix (same
  // idiom as CRM_*/VOICE_*) and look up their tier instead of a Package.
  const isCreditTopup = payment.plan.startsWith("CREDITS_");
  const planInfo = isCreditTopup
    ? await prisma.creditPricingTier.findUnique({ where: { id: payment.plan.slice("CREDITS_".length) } })
        .then((tier) => (tier ? { credits: tier.creditsAmount, days: 0 } : undefined))
    : await prisma.package.findUnique({ where: { planCode: payment.plan } })
        .then((pkg) => (pkg ? { credits: pkg.credits, days: pkg.duration, crmSeatLimit: pkg.crmSeatLimit, teamSeatLimit: pkg.teamSeatLimit } : undefined));
  await activatePlanForPayment(payment, result.refId || "", authority, planInfo);

  // Wallet discount is debited inside activatePlanForPayment's claim
  // transaction, so a replayed callback can never deduct it twice.

  // Referral reward — first paid purchase by a referred user grants a credit
  // bonus to the referred user and a wallet commission (% of the purchase,
  // admin-configurable) to the referrer. Guarded by referralRewarded so a
  // plan renewal (a second successful payment) never grants it twice.
  if (payment.user.referredBy) {
    await grantReferralReward(payment.userId, payment.user.referredBy, REFERRAL_BONUS_CREDITS, payment.amount, payment.id)
      .catch((err) => logError({ source: "/api/payment/verify (referral reward)", error: err, userId: payment.userId }));
  }

  // Send confirmation email -- a credit top-up isn't a "subscription", so it
  // gets a friendly "N credits" label instead of the raw internal plan string.
  if (payment.user.email) {
    const emailPlanLabel = isCreditTopup ? `${planInfo?.credits ?? ""} اعتبار`.trim() : payment.plan;
    sendPaymentConfirmEmail(
      payment.user.email,
      payment.user.name || "کاربر",
      emailPlanLabel,
      payment.amount,
      result.refId || ""
    ).catch((err) => logError({ source: "/api/payment/verify (confirmation email)", error: err, level: "warn", userId: payment.userId }));
  }

  return NextResponse.redirect(`${appUrl}${resultPath(payment)}?payment=success&ref=${result.refId}`);
}
