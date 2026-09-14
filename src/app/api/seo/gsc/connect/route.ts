export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getGscOAuthUrl } from "@/lib/googleSearchConsole";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  // Was a 500 reading "GOOGLE_SEARCH_CONSOLE_CLIENT_ID تنظیم نشده" — Persian
  // regardless of UI language, framed as a server crash, and leaking an
  // environment variable name to end users (QA 2026-09-15, SEO connection
  // error). It's a not-yet-available integration, so say that.
  if (!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID) {
    const lang = await getServerLang();
    return NextResponse.json({
      error: tri(lang,
        "اتصال به Google Search Console هنوز روی این سرور فعال نشده است. بقیهٔ ابزارهای سئو بدون آن کار می‌کنند.",
        "Google Search Console connection isn't enabled on this server yet. The other SEO tools work without it.",
        "Die Verbindung zur Google Search Console ist auf diesem Server noch nicht aktiviert. Die übrigen SEO-Tools funktionieren auch ohne sie."),
      code: "gsc_not_configured",
    }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const redirectUri = `${appUrl}/api/seo/gsc/callback`;
  const url = getGscOAuthUrl(redirectUri, user.id);
  return NextResponse.redirect(url);
}
