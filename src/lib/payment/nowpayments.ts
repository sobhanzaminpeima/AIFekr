import crypto from "crypto";

/**
 * USDT (TRC20) payment provider — added to the same payment layer Zarinpal
 * uses (see PaymentRequest/PaymentResult shapes below, mirrored from
 * zarinpal.ts), not a separate parallel path. Uses NowPayments' hosted
 * Invoice API (redirect flow, same UX shape as Zarinpal's StartPay redirect)
 * rather than their raw Payment API, so the user experience — redirect to
 * pay, redirect back — matches the existing Zarinpal flow exactly.
 *
 * Crypto payments are irreversible, so plan activation happens ONLY from the
 * IPN webhook (src/app/api/webhooks/nowpayments/route.ts) once NowPayments
 * itself reports the required blockchain confirmations — never optimistically
 * on the browser's return to success_url. See that route for the signature
 * verification and confirmation-count handling.
 */

const NOWPAYMENTS_BASE = "https://api.nowpayments.io/v1";

function getApiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error("کلید NOWPAYMENTS_API_KEY تنظیم نشده است");
  return key;
}

export interface UsdtPaymentRequest {
  amountUsd: number;
  description: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  ipnCallbackUrl: string;
}

export interface UsdtPaymentResult {
  ok: boolean;
  invoiceId?: string;
  paymentUrl?: string;
  error?: string;
}

export async function createUsdtInvoice(req: UsdtPaymentRequest): Promise<UsdtPaymentResult> {
  try {
    const res = await fetch(`${NOWPAYMENTS_BASE}/invoice`, {
      method: "POST",
      headers: { "x-api-key": getApiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: req.amountUsd,
        price_currency: "usd",
        pay_currency: "usdttrc20",
        order_id: req.orderId,
        order_description: req.description,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        ipn_callback_url: req.ipnCallbackUrl,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || `NowPayments error ${res.status}` };
    return { ok: true, invoiceId: String(data.id), paymentUrl: data.invoice_url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطا در ارتباط با درگاه USDT" };
  }
}

/**
 * IPN signature verification — NowPayments signs the JSON body (keys sorted
 * alphabetically, no whitespace) with HMAC-SHA512 using the IPN secret, sent
 * as the `x-nowpayments-sig` header. Rejecting an unsigned/mis-signed IPN is
 * the only thing standing between "someone posts a fake 'paid' webhook" and
 * "we grant them a free plan" — this must never be skipped.
 */
export function verifyIpnSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signatureHeader) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const sortedBody = JSON.stringify(sortKeys(parsed));
  const expected = crypto.createHmac("sha512", secret).update(sortedBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch etc — definitely not equal
  }
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {} as Record<string, unknown>);
  }
  return obj;
}
