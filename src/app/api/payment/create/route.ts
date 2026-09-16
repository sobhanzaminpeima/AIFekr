export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPayment } from "@/lib/payment/zarinpal";
import { createUsdtInvoice } from "@/lib/payment/nowpayments";
import { getFxRates } from "@/lib/utils/currency";
import { createPendingPayment, markPaymentAuthority, markPaymentFailed, findPaymentById, activatePlanForPayment } from "@/lib/repositories/paymentRepository";

// Annual billing: 2 months free ≈ 16.67% discount
const ANNUAL_DISCOUNT = 2 / 12;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { plan, period, gateway, useWallet } = await req.json();
  const selectedGateway: "zarinpal" | "usdt_trc20" = gateway === "usdt_trc20" ? "usdt_trc20" : "zarinpal";
  // Stored on the Payment row so activation grants the term that was charged.
  const periodMonths = period === "annual" ? 12 : 1;
  const pkg = await prisma.package.findUnique({ where: { planCode: plan } });
  if (!pkg || !pkg.isActive) return NextResponse.json({ error: "پلن نامعتبر" }, { status: 400 });

  // Zarinpal is Iran-only, so an INTL-market plan (price=0 in Rial, real
  // price lives in priceUsd) still has to redirect to contact for it.
  // USDT/crypto has no such restriction — it's precisely the option that
  // lets an international customer pay at all, so it must work for every
  // market (IR, INTL, and BOTH), priced directly off pkg.priceUsd when set.
  if (selectedGateway === "zarinpal" && pkg.market === "INTL") {
    return NextResponse.json({ error: "پلن بین‌الملل — با ما تماس بگیرید" }, { status: 400 });
  }
  if (selectedGateway === "usdt_trc20" && pkg.priceUsd == null && pkg.price <= 0) {
    return NextResponse.json({ error: "این پلن قیمت‌گذاری نشده است" }, { status: 400 });
  }

  const baseToman  = Math.round(pkg.price / 10);
  const listToman  = period === "annual"
    ? Math.round(baseToman * 12 * (1 - ANNUAL_DISCOUNT))
    : baseToman;

  // Affiliate-wallet "use as balance" option — a same-currency (Toman)
  // discount against the wallet's own balance, applied at checkout. No FX
  // conversion involved (unlike converting Toman to platform credits, which
  // the app has no established rate for), so this is the one wallet-spend
  // path that can't be an invented number. Meaningless for an INTL-priced
  // plan (pkg.price is 0 there) — the wallet is Toman-only, so it's skipped.
  let walletDiscount = 0;
  if (useWallet && pkg.price > 0) {
    const walletUser = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    walletDiscount = Math.min(walletUser?.walletBalance || 0, listToman);
  }
  const toman = listToman - walletDiscount;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";

  // Wallet balance fully covers the purchase — activate directly, no gateway involved.
  if (walletDiscount > 0 && toman <= 0) {
    const pending = await createPendingPayment({ userId: user.id, amount: 0, plan, gateway: selectedGateway, walletDiscountToman: walletDiscount, periodMonths });
    const payment = await findPaymentById(pending.id);
    if (!payment) return NextResponse.json({ error: "خطای داخلی" }, { status: 500 });

    const planInfo = { credits: pkg.credits, days: pkg.duration, crmSeatLimit: pkg.crmSeatLimit };
    // `authority` is unique on Payment — must be per-payment, not a shared
    // literal, or a second wallet-covered purchase (same or another user)
    // collides on it and crashes.
    await activatePlanForPayment(payment, "WALLET", `wallet-${payment.id}`, planInfo);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { walletBalance: { decrement: walletDiscount } } }),
      prisma.walletTransaction.create({
        data: { userId: user.id, type: "redeem_at_checkout", amount: -walletDiscount, relatedPaymentId: payment.id, note: `استفاده از موجودی ولت برای خرید ${plan}` },
      }),
    ]);

    return NextResponse.json({ activatedByWallet: true, paymentId: payment.id });
  }

  // A partial wallet discount is only recorded here (walletDiscountToman on
  // the Payment row) — the actual wallet deduction + ledger entry happens
  // at payment SUCCESS (payment/verify, webhooks/nowpayments), never at
  // creation, so an abandoned or failed checkout never costs the user real
  // wallet money for nothing.
  if (selectedGateway === "usdt_trc20") {
    // Prefer the plan's own USD price (INTL/BOTH-market plans, and any
    // IR-market plan that also has one) so an international purchase never
    // round-trips through the Toman price and an FX rate for no reason;
    // Iran-only plans (priceUsd null) fall back to converting the discounted
    // Toman total, same as before this plan-market fix. Either way we also
    // need a Toman-equivalent `amount` on the Payment row: referral
    // commission (grantReferralReward) and the confirmation email are both
    // Toman-denominated, and would silently pay referrers ₸0 commission on
    // every INTL/USD crypto sale otherwise.
    let amountUsd: number;
    let effectiveToman: number;
    if (pkg.priceUsd != null) {
      const baseUsd = pkg.priceUsd / 100;
      amountUsd = period === "annual" ? Math.round(baseUsd * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100 : baseUsd;
      const rates = await getFxRates();
      effectiveToman = Math.round(amountUsd * rates.usdToToman);
    } else {
      const rates = await getFxRates();
      amountUsd = Math.round((toman / rates.usdToToman) * 100) / 100;
      effectiveToman = toman;
    }

    const payment = await createPendingPayment({ userId: user.id, amount: effectiveToman, plan, gateway: "usdt_trc20", walletDiscountToman: walletDiscount, periodMonths });

    const result = await createUsdtInvoice({
      amountUsd,
      description: `خرید اشتراک ${plan} — هوشمند AI`,
      orderId: payment.id,
      successUrl: `${appUrl}/plans?payment=pending`,
      cancelUrl: `${appUrl}/plans?payment=failed`,
      ipnCallbackUrl: `${appUrl}/api/webhooks/nowpayments`,
    });

    if (!result.ok) {
      await markPaymentFailed(payment.id);
      return NextResponse.json({ error: result.error || "خطا در ایجاد پرداخت USDT" }, { status: 500 });
    }
    await markPaymentAuthority(payment.id, result.invoiceId);
    return NextResponse.json({ paymentUrl: result.paymentUrl, paymentId: payment.id });
  }

  // Zarinpal validates the callback domain against whatever domain the merchant
  // ID was registered under — this merchant is registered for rosedigital.ir,
  // not aifekr.com, so the callback sent to Zarinpal must be on a subdomain of
  // that domain (pay.rosedigital.ir) even though the rest of the app lives on
  // aifekr.com. The route itself is the same Next.js instance either way, and
  // verify/route.ts always redirects the browser back to NEXT_PUBLIC_APP_URL
  // afterward, so the user experience is unaffected.
  const callbackBaseUrl = process.env.ZARINPAL_CALLBACK_BASE_URL || appUrl;

  // Create pending payment record
  const payment = await createPendingPayment({ userId: user.id, amount: toman, plan, gateway: "zarinpal", walletDiscountToman: walletDiscount, periodMonths });

  const result = await createPayment({
    amount: toman,
    description: `خرید اشتراک ${plan} — هوشمند AI`,
    callbackUrl: `${callbackBaseUrl}/api/payment/verify?paymentId=${payment.id}`,
    mobile: user.phone || undefined,
    email: user.email || undefined,
    metadata: { planId: plan, paymentDbId: payment.id },
  });

  if (!result.ok) {
    await markPaymentFailed(payment.id);
    return NextResponse.json({ error: result.error || "خطا در ایجاد پرداخت" }, { status: 500 });
  }

  await markPaymentAuthority(payment.id, result.authority);

  return NextResponse.json({ paymentUrl: result.paymentUrl, paymentId: payment.id });
}
