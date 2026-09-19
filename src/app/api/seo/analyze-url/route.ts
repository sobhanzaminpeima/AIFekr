export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { crawlUrlDetailed, auditUrlPage } from "@/lib/seo/urlAudit";
import { normalizeUrlInput } from "@/lib/seo/urlInput";
import { crawlFailureMessage } from "@/lib/seo/crawlMessages";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { url: rawUrl, language } = await req.json().catch(() => ({}));
  const lang: Lang = language === "de" ? "de" : language === "en" ? "en" : language === "tr" ? "tr" : "fa";

  // Accept "mysite.com" as well as a full URL -- most people type the bare domain.
  const url = normalizeUrlInput(typeof rawUrl === "string" ? rawUrl : "");
  if (!url) {
    return NextResponse.json({
      error: tri(lang, "آدرس وب‌سایت معتبر نیست. مثال: mysite.com", "That doesn't look like a website address. Example: mysite.com", "Das ist keine gültige Website-Adresse. Beispiel: meineseite.de", "Bu geçerli bir web adresi değil. Örnek: sitem.com"),
      reason: "invalid_url",
    }, { status: 400 });
  }

  const result = await crawlUrlDetailed(url);
  if (!("data" in result)) return NextResponse.json({ error: crawlFailureMessage(lang, result), reason: result.reason }, { status: 502 });

  const { score, groups } = auditUrlPage(result.data, url, lang);
  return NextResponse.json({ score, groups, url });
}
