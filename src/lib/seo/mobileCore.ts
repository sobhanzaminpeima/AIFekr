import type { CrawledPageData } from "@/lib/seo/urlAudit";
import type { StoredIssue } from "@/lib/seo/siteAuditCore";

/**
 * Mobile-vs-desktop checks. Google indexes the MOBILE version of a page first, so what
 * a phone gets matters more than what a desktop browser gets. The page is fetched twice
 * (a desktop and a mobile user agent) and these checks report where the phone gets a
 * worse page: missing headings or content, a noindex only phones see, a separate m.
 * subdomain, or a slow/heavy response.
 *
 * Only NON-passing checks are returned (an audit stores just those). Ids are prefixed
 * "mobile_" so the audit diff can tell mobile issues from desktop ones.
 */
type Lang = "fa" | "en" | "de" | "tr";

export const MOBILE_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 (compatible; AiFekrSEOBot/1.0)";

const bareHost = (u: string): string => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

export function mobileIssues(desktop: CrawledPageData, mobile: CrawledPageData, requestedUrl: string, lang: Lang): StoredIssue[] {
  const t = (fa: string, en: string, de: string) => (lang === "fa" ? fa : lang === "de" ? de : en);
  const out: StoredIssue[] = [];
  const add = (id: string, status: "warning" | "fail", label: string, detail: string) => out.push({ id: `mobile_${id}`, label: `📱 ${label}`, status, detail: detail.slice(0, 240) });

  // A phone-only noindex removes the page from Google's (mobile-first) index entirely.
  const noindex = (d: CrawledPageData) => /noindex/i.test(d.robotsMeta) || /noindex/i.test(d.xRobotsTag || "");
  if (noindex(mobile) && !noindex(desktop)) {
    add("noindex", "fail", t("ایندکس در موبایل", "Indexable on mobile", "Indexierbar auf Mobilgeräten"), t("نسخه موبایل noindex دارد ولی دسکتاپ ندارد — گوگل این صفحه را ایندکس نمی‌کند.", "The mobile version is noindex but desktop isn't — Google won't index this page.", "Die mobile Version hat noindex, Desktop nicht — Google indexiert diese Seite nicht."));
  }

  if (desktop.h1.length > 0 && mobile.h1.length === 0) {
    add("h1", "fail", t("تگ H1 در موبایل", "H1 on mobile", "H1 auf Mobilgeräten"), t("در نسخه موبایل H1 وجود ندارد در حالی که دسکتاپ دارد.", "The mobile version has no H1 although desktop does.", "Die mobile Version hat kein H1, Desktop schon."));
  }

  if (desktop.wordCount >= 200 && mobile.wordCount < desktop.wordCount * 0.7) {
    add("content", "warning", t("محتوای موبایل", "Mobile content parity", "Inhalt auf Mobilgeräten"), t(`نسخه موبایل فقط ${mobile.wordCount} کلمه دارد در برابر ${desktop.wordCount} در دسکتاپ — گوگل نسخه موبایل را می‌سنجد.`, `The mobile version has ${mobile.wordCount} words vs ${desktop.wordCount} on desktop — Google ranks the mobile version.`, `Die mobile Version hat ${mobile.wordCount} Wörter, Desktop ${desktop.wordCount} — Google bewertet die mobile Version.`));
  }

  if (desktop.title && mobile.title && desktop.title.trim() !== mobile.title.trim()) {
    add("title", "warning", t("عنوان در موبایل", "Title differs on mobile", "Titel weicht auf Mobilgeräten ab"), t(`عنوان موبایل با دسکتاپ فرق دارد: «${mobile.title}»`, `The mobile title differs: “${mobile.title}”`, `Der mobile Titel weicht ab: „${mobile.title}“`));
  }

  const finalHost = bareHost(mobile.finalUrl || requestedUrl);
  if (finalHost && finalHost !== bareHost(requestedUrl)) {
    add("redirect", "warning", t("آدرس جدا برای موبایل", "Separate mobile URL", "Separate mobile URL"), t(`موبایل به ${finalHost} هدایت می‌شود. طراحی واکنش‌گرا (یک آدرس برای همه) برای سئو بهتر است.`, `Phones are redirected to ${finalHost}. A responsive design (one URL for everyone) is better for SEO.`, `Mobilgeräte werden zu ${finalHost} umgeleitet. Ein responsives Design (eine URL für alle) ist für SEO besser.`));
  }

  if (mobile.responseTimeMs > 4000) add("speed", "fail", t("سرعت پاسخ موبایل", "Mobile response time", "Antwortzeit mobil"), `${mobile.responseTimeMs} ms`);
  else if (mobile.responseTimeMs > 2500) add("speed", "warning", t("سرعت پاسخ موبایل", "Mobile response time", "Antwortzeit mobil"), `${mobile.responseTimeMs} ms`);

  if (mobile.htmlSize > 400_000) {
    add("size", "warning", t("حجم صفحه در موبایل", "Page weight on mobile", "Seitengröße auf Mobilgeräten"), t(`${Math.round(mobile.htmlSize / 1024)} کیلوبایت HTML — روی اینترنت موبایل کند می‌شود.`, `${Math.round(mobile.htmlSize / 1024)} KB of HTML — slow on mobile connections.`, `${Math.round(mobile.htmlSize / 1024)} KB HTML — langsam bei mobilen Verbindungen.`));
  }
  return out;
}

/**
 * Checks that are fine on desktop but not on the phone crawl (e.g. the phone response lacks the
 * viewport tag). Ones failing on both are already reported for desktop and are not repeated.
 */
export function mobileOnlyRegressions(
  desktopChecks: { id: string; status: string }[],
  mobileChecks: { id: string; label: string; status: string; detail: string }[],
): StoredIssue[] {
  const desktopBad = new Set(desktopChecks.filter((c) => c.status !== "pass").map((c) => c.id));
  return mobileChecks
    .filter((c) => c.status !== "pass" && !desktopBad.has(c.id) && c.id !== "responseTime" && c.id !== "server")
    .map((c) => ({ id: `mobile_${c.id}`, label: `📱 ${c.label}`, status: c.status === "fail" ? "fail" as const : "warning" as const, detail: c.detail.slice(0, 240) }));
}
