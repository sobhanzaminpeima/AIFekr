export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyIpnSignature } from "@/lib/payment/nowpayments";
import { findPaymentById, markPaymentFailed, activatePlanForPayment } from "@/lib/repositories/paymentRepository";
import { sendPaymentConfirmEmail } from "@/lib/email/resend";
import { REFERRAL_BONUS_CREDITS } from "@/lib/utils/credits";
import { grantReferralReward } from "@/lib/utils/referralWallet";

/**
 * NowPayments IPN — this is the ONLY place a USDT payment gets activated.
 * The browser's return to success_url is purely cosmetic; a crypto payment
 * is irreversible once confirmed, so we only trust NowPayments' own
 * server-to-server report of the required blockchain confirmations, never
 * the user's redirect back to our site.
 *
 * payment_status progression: waiting -> confirming -> confirmed -> finished
 * (or failed/expired/refunded). We only activate on "finished" — NowPayments
 * itself already enforces its configured confirmation-count threshold before
 * reporting that status, so we don't need to re-count confirmations
 * ourselves.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-nowpayments-sig");

  if (!verifyIpnSignature(rawBody, signature)) {
    console.error("NowPayments IPN: signature verification failed");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const data = JSON.parse(rawBody);
  const paymentId: string | undefined = data.order_id;
  const status: string | undefined = data.payment_status;

  if (!paymentId || !status) return NextResponse.json({ ok: true }); // malformed — ack, nothing to do

  const payment = await findPaymentById(paymentId);
  if (!payment) return NextResponse.json({ ok: true });

  if (status === "failed" || status === "expired" || status === "refunded") {
    if (payment.status === "PENDING") await markPaymentFailed(paymentId);
    return NextResponse.json({ ok: true });
  }

  if (status !== "finished") {
    // waiting / confirming / confirmed (not yet finished) — nothing to do
    // yet, wait for the next IPN call. The watchdog cron
    // (src/app/api/cron/usdt-payment-watchdog) flags anything stuck here
    // too long for support to check manually.
    return NextResponse.json({ ok: true });
  }

  // Idempotency — NowPayments can resend the same IPN; only activate once.
  if (payment.status !== "PENDING") return NextResponse.json({ ok: true });

  const pkg = await prisma.package.findUnique({ where: { planCode: payment.plan } });
  const planInfo = pkg ? { credits: pkg.credits, days: pkg.duration, crmSeatLimit: pkg.crmSeatLimit } : undefined;
  const refId = String(data.payment_id || data.invoice_id || "");
  await activatePlanForPayment(payment, refId, payment.authority || "", planInfo);

  if (payment.walletDiscountToman > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: payment.userId }, data: { walletBalance: { decrement: payment.walletDiscountToman } } }),
      prisma.walletTransaction.create({
        data: { userId: payment.userId, type: "redeem_at_checkout", amount: -payment.walletDiscountToman, relatedPaymentId: payment.id, note: `استفاده از موجودی ولت برای خرید ${payment.plan}` },
      }),
    ]).catch((err) => console.error("Wallet discount deduction failed:", err));
  }

  if (payment.user.referredBy && !payment.user.referralRewarded) {
    await grantReferralReward(payment.userId, payment.user.referredBy, REFERRAL_BONUS_CREDITS, payment.amount, payment.id).catch((err) => console.error("Referral reward grant failed:", err));
  }
  if (payment.user.email) {
    sendPaymentConfirmEmail(payment.user.email, payment.user.name || "کاربر", payment.plan, payment.amount, refId).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
