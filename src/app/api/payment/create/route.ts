export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPayment } from "@/lib/payment/zarinpal";
import { createPendingPayment, markPaymentAuthority, markPaymentFailed } from "@/lib/repositories/paymentRepository";

// Annual billing: 2 months free ≈ 16.67% discount
const ANNUAL_DISCOUNT = 2 / 12;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { plan, period } = await req.json();
  const pkg = await prisma.package.findUnique({ where: { planCode: plan } });
  if (!pkg || !pkg.isActive) return NextResponse.json({ error: "پلن نامعتبر" }, { status: 400 });

  // International plans have price=0 in DB — redirect to contact
  if (pkg.market === "INTL") {
    return NextResponse.json({ error: "پلن بین‌الملل — با ما تماس بگیرید" }, { status: 400 });
  }

  const baseToman  = Math.round(pkg.price / 10);
  const toman      = period === "annual"
    ? Math.round(baseToman * 12 * (1 - ANNUAL_DISCOUNT))
    : baseToman;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  // Zarinpal validates the callback domain against whatever domain the merchant
  // ID was registered under — this merchant is registered for rosedigital.ir,
  // not aifekr.com, so the callback sent to Zarinpal must be on a subdomain of
  // that domain (pay.rosedigital.ir) even though the rest of the app lives on
  // aifekr.com. The route itself is the same Next.js instance either way, and
  // verify/route.ts always redirects the browser back to NEXT_PUBLIC_APP_URL
  // afterward, so the user experience is unaffected.
  const callbackBaseUrl = process.env.ZARINPAL_CALLBACK_BASE_URL || appUrl;

  // Create pending payment record
  const payment = await createPendingPayment({ userId: user.id, amount: toman, plan, gateway: "zarinpal" });

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
