export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPayment } from "@/lib/payment/zarinpal";
import { createPendingPayment, markPaymentAuthority, markPaymentFailed } from "@/lib/repositories/paymentRepository";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { rateLimit } from "@/lib/utils/rateLimit";

/**
 * Starts a Zarinpal checkout for a one-off credit top-up tier -- same
 * gateway/callback pattern as /api/payment/create, but for a
 * CreditPricingTier instead of a subscription Package. The Payment row's
 * `plan` field is set to "CREDITS_<tierId>" so /api/payment/verify's
 * existing prefix dispatch (see paymentRepository.activatePlanForPayment)
 * routes it to a straight credits increment instead of plan activation.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  // Phase 6 hardening: same reasoning as /api/payment/create's limiter --
  // this also hits Zarinpal per call, and had no cap at all before.
  const limit = rateLimit(`credits-purchase:${user.id}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: tri(lang, "تعداد درخواست خرید بیش از حد مجاز — کمی صبر کنید", "Too many purchase attempts — please wait a moment", "Zu viele Kaufversuche — bitte warten Sie einen Moment") }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  const { tierId } = await req.json();
  if (!tierId || typeof tierId !== "string") {
    return NextResponse.json({ error: tri(lang, "تعرفه نامعتبر است", "Invalid tier", "Ungültige Stufe") }, { status: 400 });
  }

  const tier = await prisma.creditPricingTier.findUnique({ where: { id: tierId } });
  if (!tier || !tier.isActive) {
    return NextResponse.json({ error: tri(lang, "این تعرفه فعال نیست", "This tier is not active", "Diese Stufe ist nicht aktiv") }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  // Same cross-domain note as /api/payment/create: this Zarinpal merchant is
  // registered under rosedigital.ir, not aifekr.com.
  const callbackBaseUrl = process.env.ZARINPAL_CALLBACK_BASE_URL || appUrl;

  const payment = await createPendingPayment({
    userId: user.id,
    amount: tier.priceToman,
    plan: `CREDITS_${tier.id}`,
    gateway: "zarinpal",
  });

  const result = await createPayment({
    amount: tier.priceToman,
    description: tri(lang,
      `خرید ${tier.creditsAmount} اعتبار — AiFekr`,
      `Purchase ${tier.creditsAmount} credits — AiFekr`,
      `Kauf von ${tier.creditsAmount} Guthaben — AiFekr`),
    callbackUrl: `${callbackBaseUrl}/api/payment/verify?paymentId=${payment.id}`,
    mobile: user.phone || undefined,
    email: user.email || undefined,
    metadata: { creditTierId: tier.id, paymentDbId: payment.id },
  });

  if (!result.ok) {
    await markPaymentFailed(payment.id);
    return NextResponse.json({ error: result.error || tri(lang, "خطا در ایجاد پرداخت", "Failed to create payment", "Zahlung konnte nicht erstellt werden") }, { status: 500 });
  }

  await markPaymentAuthority(payment.id, result.authority);

  return NextResponse.json({ paymentUrl: result.paymentUrl, paymentId: payment.id });
}
