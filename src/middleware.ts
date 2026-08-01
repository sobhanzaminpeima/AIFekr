import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/utils/rateLimit";

// Path-prefix -> { limit, windowMs }. First match wins (checked in order).
// Auth endpoints get the tightest limits (brute-force/OTP-spam protection);
// AI-generation endpoints are limited to protect provider budgets and the
// single VPS from being hammered; everything else under /api gets a generous
// default so normal UI polling never trips it.
const RULES: Array<{ prefix: string; limit: number; windowMs: number }> = [
  { prefix: "/api/auth/send-otp", limit: 5, windowMs: 10 * 60 * 1000 },
  { prefix: "/api/auth/verify-otp", limit: 10, windowMs: 10 * 60 * 1000 },
  { prefix: "/api/auth/login", limit: 15, windowMs: 5 * 60 * 1000 },
  { prefix: "/api/auth/register", limit: 10, windowMs: 15 * 60 * 1000 },
  { prefix: "/api/chat", limit: 40, windowMs: 60 * 1000 },
  { prefix: "/api/business-doctor", limit: 20, windowMs: 60 * 1000 },
  { prefix: "/api/ceo", limit: 20, windowMs: 60 * 1000 },
  { prefix: "/api/seo/agent-pipeline/run", limit: 10, windowMs: 60 * 1000 },
  { prefix: "/api/seo/analyze", limit: 20, windowMs: 60 * 1000 },
  { prefix: "/api/image/generate", limit: 15, windowMs: 60 * 1000 },
  { prefix: "/api/video/generate", limit: 10, windowMs: 60 * 1000 },
  { prefix: "/api/music/generate", limit: 10, windowMs: 60 * 1000 },
  { prefix: "/api/social/generate", limit: 15, windowMs: 60 * 1000 },
  { prefix: "/api/website-designer/generate", limit: 10, windowMs: 60 * 1000 },
  { prefix: "/api/startup/generate", limit: 10, windowMs: 60 * 1000 },
  { prefix: "/api/payment", limit: 20, windowMs: 60 * 1000 },
  { prefix: "/api", limit: 120, windowMs: 60 * 1000 },
];

/**
 * Best-effort userId extraction from the session cookie for rate-limit bucketing only —
 * the JWT signature is NOT verified here (edge middleware avoids the Node crypto cost of
 * full verification on every request). A forged userId can only shift which bucket a
 * request counts against, it cannot bypass auth or access another user's data — actual
 * authorization still goes through requireAuth()'s verified check in each route.
 */
function unverifiedUserId(req: NextRequest): string | null {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.userId === "string" ? json.userId : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  // Logged-in requests bucket by account (a shared IP — office, campus, carrier-grade
  // NAT — must not throttle every user behind it together); anonymous requests fall
  // back to IP, which is what actually protects auth endpoints from credential stuffing.
  const identity = unverifiedUserId(req) ?? getClientIp(req.headers);
  const key = `${rule.prefix}:${identity}`;
  const result = rateLimit(key, rule.limit, rule.windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "درخواست‌های شما بیش از حد مجاز است. کمی صبر کنید و دوباره تلاش کنید." },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
