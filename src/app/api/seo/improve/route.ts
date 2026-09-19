export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { crawlUrlDetailed, auditUrlPage } from "@/lib/seo/urlAudit";
import { normalizeUrlInput } from "@/lib/seo/urlInput";
import { crawlFailureMessage } from "@/lib/seo/crawlMessages";
import { generateImprovePlan } from "@/lib/seo/improvePlan";
import { withToolCredits } from "@/lib/utils/withToolCredits";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";

/**
 * "Improve with AI" for a page the user typed in. Re-crawls the page itself
 * (never trusts client-supplied audit data), then asks the model for a
 * prioritised fix list grounded in the measured checks. Read-only: it returns
 * suggestions; applying any of them is a separate call the user must trigger.
 * Charged like the other AI tools and refunded automatically on any error
 * status (withToolCredits).
 */
async function handlePost(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { url: rawUrl, targetKeyword, language } = await req.json().catch(() => ({}));
  const lang: Lang = language === "de" ? "de" : language === "en" ? "en" : language === "tr" ? "tr" : "fa";

  const url = normalizeUrlInput(typeof rawUrl === "string" ? rawUrl : "");
  if (!url) {
    return NextResponse.json({ error: tri(lang, "آدرس وب‌سایت معتبر نیست. مثال: mysite.com", "That doesn't look like a website address. Example: mysite.com", "Das ist keine gültige Website-Adresse. Beispiel: meineseite.de", "Bu geçerli bir web adresi değil. Örnek: sitem.com"), reason: "invalid_url" }, { status: 400 });
  }

  const crawl = await crawlUrlDetailed(url);
  if (!("data" in crawl)) return NextResponse.json({ error: crawlFailureMessage(lang, crawl), reason: crawl.reason }, { status: 502 });

  const { score, groups } = auditUrlPage(crawl.data, url, lang);

  let plan;
  try {
    plan = await generateImprovePlan({
      url, data: crawl.data, groups, score, lang,
      targetKeyword: typeof targetKeyword === "string" ? targetKeyword.trim().slice(0, 100) : undefined,
    });
  } catch (e) {
    console.error("seo improve: model call failed:", e);
    plan = null;
  }
  if (!plan) {
    return NextResponse.json({ error: tri(lang, "هوش مصنوعی پاسخ قابل استفاده‌ای نداد. اعتبار شما برگشت داده شد؛ دوباره امتحان کنید.", "The AI didn't return a usable plan. Your credits were refunded; please try again.", "Die KI hat keinen brauchbaren Plan geliefert. Ihre Credits wurden erstattet; bitte erneut versuchen.", "Yapay zekâ kullanılabilir bir plan vermedi. Kredileriniz iade edildi; lütfen tekrar deneyin."), reason: "model_failed" }, { status: 502 });
  }

  return NextResponse.json({ url, score, plan });
}

export const POST = withToolCredits("seo.improve", handlePost);
