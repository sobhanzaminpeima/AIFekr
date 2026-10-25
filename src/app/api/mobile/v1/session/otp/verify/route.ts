import { NextRequest, NextResponse } from "next/server";
import { POST as verifyOtp } from "@/app/api/auth/verify-otp/route";
import { verifyToken } from "@/lib/auth/jwt";
import { createMobileSession } from "@/lib/auth/mobileSessions";
import { normalizeIranMobile, normalizeOtpCode } from "@/lib/mobile/otpPhone";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };

/**
 * Native bridge to the web OTP verifier. The web route stays the only place
 * that checks codes and finds-or-creates the account (same user table, same
 * signup credits); this route only swaps its browser cookie for a native
 * Bearer + rotating refresh session, exactly like the password bridge.
 */
export async function POST(req: NextRequest) {
  if (process.env.MOBILE_API_ENABLED !== "true") {
    return NextResponse.json({ error: "Mobile access is not enabled", code: "MOBILE_DISABLED" }, { status: 503, headers });
  }
  const body = await req.json().catch(() => null);
  const phone = normalizeIranMobile(body?.phone), code = normalizeOtpCode(body?.code);
  if (!phone || !code) return NextResponse.json({ error: "اطلاعات ناقص است", code: "INVALID_INPUT" }, { status: 400, headers });

  const forwarded = new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({ phone, code }) });
  const result = await verifyOtp(forwarded);
  if (!result.ok) {
    const data = await result.json().catch(() => ({}));
    const retryAfter = result.headers.get("Retry-After");
    return NextResponse.json({ error: typeof data?.error === "string" ? data.error : "Verification failed" }, { status: result.status, headers: { ...headers, ...(retryAfter ? { "Retry-After": retryAfter } : {}) } });
  }
  const data = await result.json().catch(() => ({}));
  const browserToken = result.cookies.get("token")?.value;
  const identity = browserToken ? verifyToken(browserToken) : null;
  if (!identity) return NextResponse.json({ error: "Session creation failed" }, { status: 500, headers });
  try {
    const session = await createMobileSession(identity.userId, req.headers.get("x-device-name") || "Mobile device");
    if (!session) return NextResponse.json({ error: "Access denied" }, { status: 401, headers });
    // `needsProfile` drives the first-run name step; nothing else about the account is exposed here.
    const name = typeof data?.user?.name === "string" ? data.user.name.trim() : "";
    return NextResponse.json({ ...session, needsProfile: !name }, { headers });
  } catch {
    return NextResponse.json({ error: "Mobile session service unavailable" }, { status: 503, headers });
  }
}
