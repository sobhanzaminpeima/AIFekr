import { NextRequest, NextResponse } from "next/server";
import { POST as sendOtp } from "@/app/api/auth/send-otp/route";
import { normalizeIranMobile } from "@/lib/mobile/otpPhone";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };

/** Native bridge to the web OTP sender: same rate limits, SMS gateway and rules. */
export async function POST(req: NextRequest) {
  if (process.env.MOBILE_API_ENABLED !== "true") {
    return NextResponse.json({ error: "Mobile access is not enabled", code: "MOBILE_DISABLED" }, { status: 503, headers });
  }
  const body = await req.json().catch(() => null);
  const phone = normalizeIranMobile(body?.phone);
  if (!phone) return NextResponse.json({ error: "شماره موبایل معتبر نیست", code: "INVALID_PHONE" }, { status: 400, headers });

  const forwarded = new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({ phone }) });
  const result = await sendOtp(forwarded);
  const data = await result.json().catch(() => ({}));
  const retryAfter = result.headers.get("Retry-After");
  if (!result.ok) {
    return NextResponse.json({ error: typeof data?.error === "string" ? data.error : "OTP failed" }, { status: result.status, headers: { ...headers, ...(retryAfter ? { "Retry-After": retryAfter } : {}) } });
  }
  // The app's resend timer follows the server's per-phone window, not a guess.
  return NextResponse.json({ success: true, phone, resendAfterSec: 60, ...(typeof data?.dev_code === "string" ? { devCode: data.dev_code } : {}) }, { headers });
}
