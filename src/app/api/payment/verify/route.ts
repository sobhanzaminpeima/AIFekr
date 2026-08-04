export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPayment } from "@/lib/payment/zarinpal";
import { sendPaymentConfirmEmail } from "@/lib/email/resend";
import { redirect } from "next/navigation";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";
import { findPaymentById, markPaymentFailed, activatePlanForPayment } from "@/lib/repositories/paymentRepository";
import { grantReferralBonus } from "@/lib/repositories/userRepository";

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

  // Referral bonus — first paid purchase by a referred user rewards both
  // sides once. Guarded by referralRewarded so a plan renewal (a second
  // successful payment) never grants it twice.
  if (payment.user.referredBy && !payment.user.referralRewarded) {
    await grantReferralBonus(payment.userId, payment.user.referredBy, REFERRAL_BONUS_CREDITS)
      .catch((err) => console.error("Referral bonus grant failed:", err));
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
