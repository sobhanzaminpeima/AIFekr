export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPayment } from "@/lib/payment/zarinpal";
import { sendPaymentConfirmEmail } from "@/lib/email/resend";
import { redirect } from "next/navigation";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";
import { findPaymentById, markPaymentFailed, activatePlanForPayment } from "@/lib/repositories/paymentRepository";
import { grantReferralReward } from "@/lib/utils/referralWallet";
import { logError } from "@/lib/logging/errorLog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("Status");
  const authority = searchParams.get("Authority");
  const paymentId = searchParams.get("paymentId");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";

  // Credit top-ups redirect back to /credits instead of /plans -- resolved
  // up front from paymentId (works even for the early failure paths, before
  // the row's own `plan` field has been loaded below).
  const failureRedirect = async () => {
    const p = paymentId ? await findPaymentById(paymentId).catch(() => null) : null;
    return `${appUrl}${p?.plan.startsWith("CREDITS_") ? "/credits" : "/plans"}?payment=failed`;
  };

  if (status !== "OK" || !authority || !paymentId) {
    return NextResponse.redirect(await failureRedirect());
  }

  const payment = await findPaymentById(paymentId);

  if (!payment || payment.status !== "PENDING") {
    return NextResponse.redirect(await failureRedirect());
  }

  const result = await verifyPayment({ authority, amount: payment.amount });

  if (!result.ok) {
    await markPaymentFailed(paymentId);
    return NextResponse.redirect(await failureRedirect());
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
        .then((pkg) => (pkg ? { credits: pkg.credits, days: pkg.duration, crmSeatLimit: pkg.crmSeatLimit } : undefined));
  await activatePlanForPayment(payment, result.refId || "", authority, planInfo);

  // Wallet discount is only actually deducted now, on success — see the
  // comment in payment/create/route.ts for why it isn't deducted at creation.
  if (payment.walletDiscountToman > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: payment.userId }, data: { walletBalance: { decrement: payment.walletDiscountToman } } }),
      prisma.walletTransaction.create({
        data: { userId: payment.userId, type: "redeem_at_checkout", amount: -payment.walletDiscountToman, relatedPaymentId: payment.id, note: `استفاده از موجودی ولت برای خرید ${payment.plan}` },
      }),
    ]).catch((err) => logError({ source: "/api/payment/verify (wallet discount)", error: err, userId: payment.userId }));
  }

  // Referral reward — first paid purchase by a referred user grants a credit
  // bonus to the referred user and a wallet commission (% of the purchase,
  // admin-configurable) to the referrer. Guarded by referralRewarded so a
  // plan renewal (a second successful payment) never grants it twice.
  if (payment.user.referredBy && !payment.user.referralRewarded) {
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

  return NextResponse.redirect(`${appUrl}${isCreditTopup ? "/credits" : "/plans"}?payment=success&ref=${result.refId}`);
}
