import { prisma } from "@/lib/db/prisma";

// Merchant ID / sandbox flag are editable from the admin settings panel
// (SiteSetting table) so a merchant swap doesn't need a redeploy — env vars
// remain the fallback for whatever isn't set in the DB yet.
async function getConfig() {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ["zarinpal_merchant", "zarinpal_sandbox"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const merchant = map.zarinpal_merchant || process.env.ZARINPAL_MERCHANT_ID || "";
  const isSandbox = map.zarinpal_sandbox != null
    ? map.zarinpal_sandbox === "true"
    : process.env.ZARINPAL_SANDBOX === "true";

  return {
    merchant,
    isSandbox,
    base: isSandbox ? "https://sandbox.zarinpal.com/pg/v4/payment" : "https://api.zarinpal.com/pg/v4/payment",
    gate: isSandbox ? "https://sandbox.zarinpal.com/pg/StartPay" : "https://www.zarinpal.com/pg/StartPay",
  };
}

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
  const { merchant, base, gate } = await getConfig();

  if (!merchant || merchant === "your-merchant-id") {
    // Dev mode — simulate payment by redirecting straight to the real
    // callback URL (the same one Zarinpal itself would hit), instead of a
    // separate /api/payment/dev-callback route that was never implemented
    // and dropped the paymentId query param — every purchase 404'd.
    const fakeAuthority = `DEV_${Date.now()}`;
    const separator = req.callbackUrl.includes("?") ? "&" : "?";
    return { ok: true, authority: fakeAuthority, paymentUrl: `${req.callbackUrl}${separator}Authority=${fakeAuthority}&Status=OK` };
  }

  const res = await fetch(`${base}/request.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: merchant,
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
      paymentUrl: `${gate}/${data.data.authority}`,
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
  const { merchant, base } = await getConfig();

  if (!merchant || merchant === "your-merchant-id" || req.authority.startsWith("DEV_")) {
    return { ok: true, refId: `DEV_REF_${Date.now()}` };
  }

  const res = await fetch(`${base}/verify.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: merchant,
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
