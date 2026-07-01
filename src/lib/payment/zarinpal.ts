const isSandbox = process.env.ZARINPAL_SANDBOX === "true";
const MERCHANT = process.env.ZARINPAL_MERCHANT_ID || "";

const BASE = isSandbox
  ? "https://sandbox.zarinpal.com/pg/v4/payment"
  : "https://api.zarinpal.com/pg/v4/payment";

const GATE = isSandbox
  ? "https://sandbox.zarinpal.com/pg/StartPay"
  : "https://www.zarinpal.com/pg/StartPay";

export interface PaymentRequest {
  amount: number; // Toman
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  ok: boolean;
  authority?: string;
  paymentUrl?: string;
  error?: string;
  code?: number;
}

export async function createPayment(req: PaymentRequest): Promise<PaymentResult> {
  if (!MERCHANT || MERCHANT === "your-merchant-id") {
    // Dev mode — simulate payment
    const fakeAuthority = `DEV_${Date.now()}`;
    return { ok: true, authority: fakeAuthority, paymentUrl: `/api/payment/dev-callback?Authority=${fakeAuthority}&Status=OK` };
  }

  const res = await fetch(`${BASE}/request.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: MERCHANT,
      amount: req.amount * 10, // Rial
      description: req.description,
      callback_url: req.callbackUrl,
      metadata: {
        mobile: req.mobile,
        email: req.email,
        ...req.metadata,
      },
    }),
  });

  const data = await res.json();

  if (data.data?.code === 100) {
    return {
      ok: true,
      authority: data.data.authority,
      paymentUrl: `${GATE}/${data.data.authority}`,
    };
  }

  return { ok: false, error: data.errors?.message || "خطای درگاه پرداخت", code: data.data?.code };
}

export interface VerifyRequest {
  authority: string;
  amount: number; // Toman
}

export interface VerifyResult {
  ok: boolean;
  refId?: string;
  cardPan?: string;
  error?: string;
  code?: number;
}

export async function verifyPayment(req: VerifyRequest): Promise<VerifyResult> {
  if (!MERCHANT || MERCHANT === "your-merchant-id" || req.authority.startsWith("DEV_")) {
    return { ok: true, refId: `DEV_REF_${Date.now()}` };
  }

  const res = await fetch(`${BASE}/verify.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: MERCHANT,
      amount: req.amount * 10,
      authority: req.authority,
    }),
  });

  const data = await res.json();

  if (data.data?.code === 100 || data.data?.code === 101) {
    return { ok: true, refId: String(data.data.ref_id), cardPan: data.data.card_pan };
  }

  return { ok: false, error: data.errors?.message || "تأیید پرداخت ناموفق", code: data.data?.code };
}
