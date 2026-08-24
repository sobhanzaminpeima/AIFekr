export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPayment } from "@/lib/payment/zarinpal";
import { sendPaymentConfirmEmail } from "@/lib/email/resend";
import { redirect } from "next/navigation";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";
import { findPaymentById, markPaymentFailed, activatePlanForPayment } from "@/lib/repositories/paymentRepository";
import { grantReferralReward } from "@/lib/utils/referralWallet";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("Status");
  const authority = searchParams.get("Authority");
  const paymentId = searchParams.get("paymentId");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";

  if (status !== "OK" || !authority || !paymentId) {
    return NextResponse.redirect(`${appUrl}/plans?payment=failed`);
  }

  const payment = await findPaymentById(paymentId);

  if (!payment || payment.status !== "PENDING") {
    return NextResponse.redirect(`${appUrl}/plans?payment=failed`);
  }

  const result = await verifyPayment({ authority, amount: payment.amount });

  if (!result.ok) {
    await markPaymentFailed(paymentId);
    return NextResponse.redirect(`${appUrl}/plans?payment=failed`);
  }

  // Success — activate plan. TEAM credits are pooled on a Team row, not on
  // User.credits directly — see src/lib/utils/teamCredits.ts.
  const pkg = await prisma.package.findUnique({ where: { planCode: payment.plan } });
  const planInfo = pkg ? { credits: pkg.credits, days: pkg.duration, crmSeatLimit: pkg.crmSeatLimit } : undefined;
  await activatePlanForPayment(payment, result.refId || "", authority, planInfo);

  // Wallet discount is only actually deducted now, on success — see the
  // comment in payment/create/route.ts for why it isn't deducted at creation.
  if (payment.walletDiscountToman > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: payment.userId }, data: { walletBalance: { decrement: payment.walletDiscountToman } } }),
      prisma.walletTransaction.create({
        data: { userId: payment.userId, type: "redeem_at_checkout", amount: -payment.walletDiscountToman, relatedPaymentId: payment.id, note: `استفاده از موجودی ولت برای خرید ${payment.plan}` },
      }),
    ]).catch((err) => console.error("Wallet discount deduction failed:", err));
  }

  // Referral reward — first paid purchase by a referred user grants a credit
  // bonus to the referred user and a wallet commission (% of the purchase,
  // admin-configurable) to the referrer. Guarded by referralRewarded so a
  // plan renewal (a second successful payment) never grants it twice.
  if (payment.user.referredBy && !payment.user.referralRewarded) {
    await grantReferralReward(payment.userId, payment.user.referredBy, REFERRAL_BONUS_CREDITS, payment.amount, payment.id)
      .catch((err) => console.error("Referral reward grant failed:", err));
  }

  // Send confirmation email
  if (payment.user.email) {
    sendPaymentConfirmEmail(
      payment.user.email,
      payment.user.name || "کاربر",
      payment.plan,
      payment.amount,
      result.refId || ""
    ).catch(console.error);
  }

  return NextResponse.redirect(`${appUrl}/plans?payment=success&ref=${result.refId}`);
}
