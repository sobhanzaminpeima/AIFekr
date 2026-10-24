import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/utils/rateLimit";
import { isPublicRoute, stripPublicLocale } from "@/lib/seo/locales";
import { moduleKeyForPath } from "@/lib/modules/moduleRoutes";
import { blockedModules } from "@/lib/modules/moduleStatus";

// Path-prefix -> { limit, windowMs }. First match wins (checked in order).
// Auth endpoints get the tightest limits (brute-force/OTP-spam protection);
// AI-generation endpoints are limited to protect provider budgets and the
// single VPS from being hammered; everything else under /api gets a generous
// default so normal UI polling never trips it.
const RULES: Array<{ prefix: string; limit: number; windowMs: number }> = [
  { prefix: "/api/mobile/v1/session", limit: 20, windowMs: 60 * 1000 },
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

// Shown verbatim by client fetch wrappers, so it follows the visitor's
// language cookie instead of always being Persian.
const RATE_LIMIT_MESSAGE: Record<string, string> = {
  fa: "درخواست‌های شما بیش از حد مجاز است. کمی صبر کنید و دوباره تلاش کنید.",
  en: "Too many requests. Please wait a moment and try again.",
  de: "Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.",
  tr: "Çok fazla istek. Lütfen biraz bekleyip tekrar deneyin.",
};

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

function routeRequest(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/")) {
    const localized = stripPublicLocale(pathname);
    const forwardedLocale = req.nextUrl.searchParams.get("__public_locale");
    const requestHeaders = new Headers(req.headers);
    requestHeaders.delete("x-public-lang");
    requestHeaders.set("x-aifekr-path", pathname + req.nextUrl.search);
    if (isPublicRoute(localized.path)) {
      const effectiveLang = pathname === localized.path && ["en", "de", "tr"].includes(forwardedLocale ?? "") ? forwardedLocale! : localized.lang;
      requestHeaders.set("x-public-lang", effectiveLang);
      if (pathname !== localized.path) {
        const target = req.nextUrl.clone();
        // TLS terminates at the reverse proxy; the local Next server is HTTP.
        // Next may retain the forwarded HTTPS scheme with its localhost origin.
        const localProxy = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.protocol === "https:";
        if (localProxy) {
          target.protocol = "http:";
          // Cross-protocol rewrites are proxied as a second request by Next.
          // Carry the locale through that request; middleware headers alone
          // are not forwarded by the external rewrite proxy.
          target.searchParams.set("__public_locale", localized.lang);
        }
        target.pathname = localized.path;
        // Industry records currently contain Persian/English/German content only.
        if (localized.lang === "tr" && localized.path.startsWith("/industry/")) {
          target.pathname = `/en${localized.path}`;
          return NextResponse.redirect(target, 308);
        }
        if (localized.lang === "fa") return NextResponse.redirect(target, 308);
        return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
      }
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  const rule = RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  // Logged-in requests bucket by account (a shared IP — office, campus, carrier-grade
  // NAT — must not throttle every user behind it together); anonymous requests fall
  // back to IP, which is what actually protects auth endpoints from credential stuffing.
  // The userId is unverified, so a caller could mint a fresh fake id per
  // request to get a new bucket every time. Every request therefore also
  // counts against its IP: at the normal limit when anonymous, and at a
  // multiple of it for signed-in traffic so a shared office/NAT IP is not
  // throttled as if it were one user.
  const ip = getClientIp(req.headers);
  // Sign-in endpoints never get the signed-in allowance: a forged cookie must
  // not multiply the brute-force budget for passwords and OTPs.
  const isAuthRule = rule.prefix.startsWith("/api/auth") || rule.prefix.startsWith("/api/mobile/v1/session");
  const userId = isAuthRule ? null : unverifiedUserId(req);
  const ipResult = rateLimit(`${rule.prefix}:ip:${ip}`, userId ? rule.limit * 5 : rule.limit, rule.windowMs);
  const result = ipResult.allowed && userId ? rateLimit(`${rule.prefix}:${userId}`, rule.limit, rule.windowMs) : ipResult;


  if (!result.allowed) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE[req.cookies.get("lang")?.value || ""] ?? RATE_LIMIT_MESSAGE.fa, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
    );
  }

  return NextResponse.next();
}

/**
 * Admin "Modules" switch: a module set to disabled/maintenance in
 * /admin/modules is taken away from users -- its API answers 503 and its
 * pages send the visitor to /home with an explanation. Admin pages and APIs
 * are never blocked, so an admin can always switch it back on.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const key = pathname.startsWith("/admin") || pathname.startsWith("/api/admin") ? null : moduleKeyForPath(pathname);
  if (key) {
    const status = (await blockedModules())[key];
    if (status) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: status === "maintenance" ? "This section is under maintenance." : "This section is currently unavailable.", code: status === "maintenance" ? "MODULE_MAINTENANCE" : "MODULE_DISABLED", module: key }, { status: 503 });
      }
      const target = req.nextUrl.clone();
      target.pathname = "/home";
      target.search = `?moduleUnavailable=${encodeURIComponent(key)}&status=${status}`;
      return NextResponse.redirect(target, 307);
    }
  }
  return routeRequest(req);
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next|.*\\..*).*)"],
};
