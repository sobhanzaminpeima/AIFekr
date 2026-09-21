import { safeFetch, UnsafeUrlError } from "@/lib/net/safeUrl";
import { MOBILE_UA } from "@/lib/seo/mobileCore";
import { decodeEntities, textOfTags, parseRobotsTxt, viewportBlocksZoom, detectWordPress, type WordPressSignals } from "@/lib/seo/htmlParse";

export interface CrawledPageData {
  title: string;
  metaDesc: string;
  metaKeywords: string;
  canonical: string;
  ogTitle: string;
  ogDesc: string;
  ogImage: string;
  robotsMeta: string;
  viewport: string;
  charset: string;
  langAttr: string;
  h1: string[];
  h2: string[];
  h3Count: number;
  images: number;
  imagesWithAlt: number;
  lazyImages: number;
  links: number;
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
  hasSchema: boolean;
  hasFavicon: boolean;
  isHttps: boolean;
  hasDeprecatedTags: boolean;
  hasInlineCss: boolean;
  htmlSize: number;
  doctype: boolean;
  server: string | null;
  responseTimeMs: number;
  statusCode: number;
  twitterCard?: string;
  hreflangCount?: number;
  /** WordPress fingerprints from the public page source; undefined when the site is not WordPress. */
  wp?: WordPressSignals;
  /** URL of the last response after redirects (differs from the request when e.g. phones are sent to an m. host). */
  finalUrl?: string;
  /** Raw hrefs found on the page (deduplicated, capped) -- lets a site audit discover more pages to crawl. */
  linkTargets?: string[];
  /** X-Robots-Tag response header (can noindex a page without any meta tag). */
  xRobotsTag?: string;
  /** Site-level crawlability, probed from the page's own origin. Undefined when the probe did not run. */
  site?: { robotsTxt: "found" | "missing" | "unknown"; blocksAll: boolean; sitemap: "found" | "missing" | "unknown" };
}

async function probeText(url: string): Promise<{ status: number; text: string; html: boolean } | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    const res = await safeFetch(url, { signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; AiFekrSEOBot/1.0)" } });
    const text = (await res.text()).slice(0, 200_000);
    clearTimeout(t);
    return { status: res.status, text, html: /text\/html/i.test(res.headers.get("content-type") || "") || /^\s*<(!doctype|html)/i.test(text) };
  } catch { return null; }
}

/** Does the site publish a robots.txt and a sitemap, and does robots.txt lock crawlers out entirely? */
async function probeSite(origin: string): Promise<NonNullable<CrawledPageData["site"]>> {
  const robots = await probeText(origin + "/robots.txt");
  const robotsOk = !!robots && robots.status === 200 && !robots.html;
  const info = robotsOk ? parseRobotsTxt(robots!.text) : { blocksAll: false, sitemaps: [] as string[] };
  const candidates = [...info.sitemaps.slice(0, 1), origin + "/sitemap.xml"];
  let sitemap: "found" | "missing" | "unknown" = robots || candidates.length ? "missing" : "unknown";
  for (const u of candidates) {
    const r = await probeText(u);
    if (r === null) { sitemap = "unknown"; continue; }
    if (r.status === 200 && !r.html && /<(urlset|sitemapindex)\b/i.test(r.text)) { sitemap = "found"; break; }
  }
  return { robotsTxt: robots === null ? "unknown" : robotsOk ? "found" : "missing", blocksAll: info.blocksAll, sitemap };
}

/** Why a page could not be crawled, so the user is told something they can act on instead of a generic failure. */
export type CrawlFailure =
  | { reason: "blocked" }                       // private/internal address or non-web scheme
  | { reason: "timeout" }                       // no answer within the crawl window
  | { reason: "http"; status: number }          // the site answered with an error (401/403/429 = it refuses our crawler)
  | { reason: "unreachable" };                  // DNS/connection failure

export async function crawlUrl(url: string): Promise<CrawledPageData | null> {
  const r = await crawlUrlDetailed(url);
  return "data" in r ? r.data : null;
}

export async function crawlUrlDetailed(url: string, opts: { probeSite?: boolean; device?: "desktop" | "mobile" } = {}): Promise<{ data: CrawledPageData } | CrawlFailure> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const start = Date.now();
    const res = await safeFetch(url, { signal: controller.signal, headers: { "User-Agent": opts.device === "mobile" ? MOBILE_UA : "Mozilla/5.0 (compatible; AiFekrSEOBot/1.0)" } });
    const responseTimeMs = Date.now() - start;
    clearTimeout(timeout);
    if (!res.ok) return { reason: "http", status: res.status };
    const html = await res.text();

    const getTag = (p: RegExp) => { const m = html.match(p); return m ? m[1]?.trim() || "" : ""; };
    const title = decodeEntities(getTag(/<title[^>]*>([^<]*)<\/title>/i));
    const metaDesc = decodeEntities(getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i));
    const metaKeywords = getTag(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i);
    const canonical = getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    const ogTitle = getTag(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    const ogDesc = getTag(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
    const ogImage = getTag(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
    const robotsMeta = getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
    const viewport = getTag(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["']/i);
    const charset = getTag(/<meta[^>]*charset=["']?([\w-]+)["']?/i);
    const langAttr = getTag(/<html[^>]*\slang=["']([^"']*)["']/i);
    const h1s = textOfTags(html, "h1");
    const h2s = textOfTags(html, "h2");
    const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
    const twitterCard = getTag(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i);
    const generator = getTag(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']*)["']/i);
    const hreflangCount = (html.match(/<link[^>]*rel=["']alternate["'][^>]*hreflang=/gi) || []).length;
    const images = (html.match(/<img[^>]*>/gi) || []).length;
    const imagesWithAlt = (html.match(/<img[^>]*alt=["'][^"']+["'][^>]*>/gi) || []).length;
    const lazyImages = (html.match(/<img[^>]*loading=["']lazy["'][^>]*>/gi) || []).length;
    const allLinks = Array.from(html.matchAll(/<a[^>]*href=["']([^"']*)["']/gi)).map((m) => m[1]);
    const links = allLinks.length;
    let hostname = "";
    try { hostname = new URL(url).hostname; } catch {}
    const internalLinks = allLinks.filter((h) => h.startsWith("/") || (hostname && h.includes(hostname))).length;
    const externalLinks = links - internalLinks;
    const wordCount = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const hasSchema = html.includes("application/ld+json");
    const hasFavicon = /<link[^>]*rel=["'](?:shortcut )?icon["']/i.test(html);
    const isHttps = url.startsWith("https://");
    const hasDeprecatedTags = /<(font|center|marquee|blink|frameset)[\s>]/i.test(html);
    const hasInlineCss = /style\s*=\s*["'][^"']+["']/i.test(html);
    const doctype = /^\s*<!doctype html>/i.test(html);
    const server = res.headers.get("server");
    let origin = "";
    try { origin = new URL(url).origin; } catch {}
    // robots.txt / sitemap are site-wide: a multi-page audit probes them once (on the homepage), not per page.
    const site = origin && opts.probeSite !== false ? await probeSite(origin) : undefined;

    return { data: {
      title, metaDesc, metaKeywords, canonical, ogTitle, ogDesc, ogImage, robotsMeta, viewport, charset, langAttr,
      h1: h1s.slice(0, 5), h2: h2s.slice(0, 10), h3Count,
      images, imagesWithAlt, lazyImages, links, internalLinks, externalLinks, wordCount,
      hasSchema, hasFavicon, isHttps, hasDeprecatedTags, hasInlineCss, htmlSize: html.length, doctype,
      server, responseTimeMs, statusCode: res.status,
      wp: detectWordPress(html, allLinks, generator) ?? undefined,
      finalUrl: res.url || url, twitterCard, hreflangCount, linkTargets: Array.from(new Set(allLinks)).slice(0, 120), xRobotsTag: res.headers.get("x-robots-tag") || "", site,
    } };
  } catch (e) {
    if (e instanceof UnsafeUrlError) return e.message === "host could not be resolved" ? { reason: "unreachable" } : { reason: "blocked" };
    if (e instanceof Error && e.name === "AbortError") return { reason: "timeout" };
    return { reason: "unreachable" };
  }
}

export type CheckStatus = "pass" | "warning" | "fail";
export interface UrlCheck { id: string; label: string; status: CheckStatus; detail: string; }
export interface UrlCheckGroup { id: string; titleFa: string; titleEn: string; titleDe: string; checks: UrlCheck[]; }

export function auditUrlPage(data: CrawledPageData, url: string, lang: "fa" | "en" | "de" | "tr"): { score: number; groups: UrlCheckGroup[] } {
  const tri = (fa: string, en: string, de: string) => lang === "fa" ? fa : lang === "de" ? de : en;
  const check = (id: string, label: string, status: CheckStatus, detail: string): UrlCheck => ({ id, label, status, detail });

  const basic: UrlCheck[] = [
    check("statusCode", tri("کد وضعیت HTTP", "HTTP status code", "HTTP-Statuscode"), data.statusCode === 200 ? "pass" : "warning", String(data.statusCode)),
    check("https", "HTTPS", data.isHttps ? "pass" : "fail", data.isHttps ? tri("سایت از HTTPS استفاده می‌کند", "Site uses HTTPS", "Site verwendet HTTPS") : tri("سایت HTTPS ندارد", "Site does not use HTTPS", "Site verwendet kein HTTPS")),
    check("doctype", tri("اعلان Doctype", "Doctype declaration", "Doctype-Deklaration"), data.doctype ? "pass" : "warning", data.doctype ? "<!DOCTYPE html>" : tri("یافت نشد", "Not found", "Nicht gefunden")),
    check("charset", tri("کدگذاری کاراکتر", "Meta charset", "Meta-Zeichensatz"), data.charset ? "pass" : "warning", data.charset || tri("یافت نشد", "Not found", "Nicht gefunden")),
    check("lang", tri("ویژگی زبان", "Language attribute", "Sprachattribut"), data.langAttr ? "pass" : "warning", data.langAttr || tri("یافت نشد", "Not found", "Nicht gefunden")),
    check("favicon", tri("فاوآیکون", "Favicon", "Favicon"), data.hasFavicon ? "pass" : "warning", data.hasFavicon ? tri("موجود است", "Present", "Vorhanden") : tri("یافت نشد", "Not found", "Nicht gefunden")),
    check("responseTime", tri("زمان پاسخ سرور", "Server response time", "Server-Antwortzeit"), data.responseTimeMs < 800 ? "pass" : data.responseTimeMs < 2000 ? "warning" : "fail", `${data.responseTimeMs}ms`),
    check("server", tri("امضای سرور", "Server signature", "Server-Signatur"), !data.server || /^(cloudflare|akamai|cloudfront|fastly|vercel|netlify)$/i.test(data.server.trim()) ? "pass" : "warning", data.server ? tri(`افشا شده: ${data.server}`, `Exposed: ${data.server}`, `Offengelegt: ${data.server}`) : tri("افشا نشده", "Not exposed", "Nicht offengelegt")),
  ];

  const onPage: UrlCheck[] = [
    check("title", tri("تگ Title", "Title tag", "Title-Tag"), !data.title ? "fail" : data.title.length >= 30 && data.title.length <= 65 ? "pass" : "warning", data.title ? `"${data.title}" (${data.title.length} ${tri("کاراکتر", "chars", "Zeichen")})` : tri("یافت نشد", "Missing", "Fehlt")),
    check("metaDesc", tri("توضیحات متا", "Meta description", "Meta-Beschreibung"), !data.metaDesc ? "fail" : data.metaDesc.length >= 110 && data.metaDesc.length <= 165 ? "pass" : "warning", data.metaDesc ? `${data.metaDesc.length} ${tri("کاراکتر", "chars", "Zeichen")}` : tri("یافت نشد", "Missing", "Fehlt")),
    check("h1", tri("تگ H1", "H1 tag", "H1-Tag"), data.h1.length === 1 ? "pass" : data.h1.length === 0 ? "fail" : "warning", data.h1.length === 0 ? tri("یافت نشد", "Missing", "Fehlt") : data.h1.length > 1 ? tri(`${data.h1.length} عدد H1 — باید فقط یکی باشد`, `${data.h1.length} H1 tags — should be exactly one`, `${data.h1.length} H1-Tags — sollte genau eins sein`) : data.h1[0]),
    check("headingStructure", tri("ساختار هدینگ‌ها", "Heading structure", "Überschriftenstruktur"), data.h2.length > 0 ? "pass" : "warning", tri(`${data.h2.length} تگ H2، ${data.h3Count} تگ H3`, `${data.h2.length} H2 tags, ${data.h3Count} H3 tags`, `${data.h2.length} H2-Tags, ${data.h3Count} H3-Tags`)),
    check("canonical", tri("تگ Canonical", "Canonical tag", "Canonical-Tag"), data.canonical ? "pass" : "warning", data.canonical || tri("یافت نشد", "Not found", "Nicht gefunden")),
    check("metaKeywords", tri("متا کلمات کلیدی", "Meta keywords", "Meta-Schlüsselwörter"), "pass", data.metaKeywords ? data.metaKeywords.slice(0, 80) : tri("استفاده نشده (اختیاری است)", "Not used (optional)", "Nicht verwendet (optional)")),
    check("robotsMeta", tri("متا Robots", "Meta robots", "Meta-Robots"), /noindex/i.test(data.robotsMeta) ? "fail" : "pass", data.robotsMeta || tri("پیش‌فرض (index, follow)", "Default (index, follow)", "Standard (index, follow)")),
    check("seoUrl", tri("URL مناسب سئو", "SEO-friendly URL", "SEO-freundliche URL"), /^https?:\/\/[^?]+$/.test(url) && !/[A-Z]/.test(new URL(url).pathname) ? "pass" : "warning", url),
  ];

  const content: UrlCheck[] = [
    check("wordCount", tri("تعداد کلمات", "Word count", "Wortanzahl"), data.wordCount >= 300 ? "pass" : "warning", String(data.wordCount)),
    check("schema", tri("داده ساختاریافته (Schema)", "Structured data (Schema)", "Strukturierte Daten (Schema)"), data.hasSchema ? "pass" : "warning", data.hasSchema ? tri("یافت شد", "Found", "Gefunden") : tri("یافت نشد", "Not found", "Nicht gefunden")),
    check("ogTags", tri("برچسب‌های OpenGraph", "OpenGraph tags", "OpenGraph-Tags"), data.ogTitle && data.ogDesc ? "pass" : "warning", `og:title ${data.ogTitle ? "✓" : "✗"}, og:description ${data.ogDesc ? "✓" : "✗"}, og:image ${data.ogImage ? "✓" : "✗"}`),
    check("twitterCard", tri("کارت توییتر/X", "Twitter/X card", "Twitter/X-Card"), data.twitterCard ? "pass" : "warning", data.twitterCard || tri("یافت نشد — پیش‌نمایش لینک در شبکه‌های اجتماعی ضعیف است", "Not found — link previews on social networks will be poor", "Nicht gefunden — Link-Vorschau in sozialen Netzwerken fällt schwach aus")),
    check("deprecatedTags", tri("تگ‌های منسوخ HTML", "Deprecated HTML tags", "Veraltete HTML-Tags"), data.hasDeprecatedTags ? "warning" : "pass", data.hasDeprecatedTags ? tri("یافت شد (font/center/marquee)", "Found (font/center/marquee)", "Gefunden (font/center/marquee)") : tri("یافت نشد", "None found", "Keine gefunden")),
    check("inlineCss", tri("CSS درون‌خطی", "Inline CSS", "Inline-CSS"), data.hasInlineCss ? "warning" : "pass", data.hasInlineCss ? tri("استفاده شده — روی سرعت اثر می‌گذارد", "In use — affects performance", "Wird verwendet — beeinträchtigt die Leistung") : tri("استفاده نشده", "Not used", "Nicht verwendet")),
  ];

  const viewportBlocked = viewportBlocksZoom(data.viewport || "");
  basic.push(check("viewportZoom", tri("زوم موبایل (Viewport)", "Mobile zoom (viewport)", "Mobile Zoom (Viewport)"), !data.viewport ? "fail" : viewportBlocked ? "warning" : "pass",
    !data.viewport ? tri("تگ viewport وجود ندارد — سایت روی موبایل درست نمایش داده نمی‌شود", "No viewport tag — the page won't render properly on mobile", "Kein Viewport-Tag — die Seite wird auf Mobilgeräten nicht korrekt dargestellt")
      : viewportBlocked ? tri("زوم کاربر مسدود است (maximum-scale/user-scalable) — مشکل دسترسی‌پذیری و موبایل", "User zoom is blocked (maximum-scale/user-scalable) — an accessibility and mobile-usability problem", "Nutzer-Zoom ist gesperrt (maximum-scale/user-scalable) — Barrierefreiheits- und Mobile-Problem")
      : data.viewport));

  const media: UrlCheck[] = [
    check("imageAlt", tri("برچسب Alt تصاویر", "Image ALT attributes", "Bild-ALT-Attribute"), data.images === 0 ? "pass" : data.imagesWithAlt === data.images ? "pass" : data.imagesWithAlt > 0 ? "warning" : "fail", tri(`${data.imagesWithAlt} از ${data.images} تصویر دارای alt`, `${data.imagesWithAlt} of ${data.images} images have alt`, `${data.imagesWithAlt} von ${data.images} Bildern haben ALT`)),
    check("lazyLoading", tri("بارگذاری تنبل تصاویر", "Lazy loading images", "Lazy-Loading für Bilder"), data.images === 0 ? "pass" : data.lazyImages > 0 ? "pass" : "warning", tri(`${data.lazyImages} از ${data.images} تصویر با lazy loading`, `${data.lazyImages} of ${data.images} images use lazy loading`, `${data.lazyImages} von ${data.images} Bildern verwenden Lazy Loading`)),
  ];

  const technical: UrlCheck[] = [
    check("htmlSize", tri("حجم صفحه", "Page size", "Seitengröße"), data.htmlSize < 200000 ? "pass" : data.htmlSize < 500000 ? "warning" : "fail", `${Math.round(data.htmlSize / 1024)} KB`),
    check("internalLinks", tri("لینک‌های داخلی", "Internal links", "Interne Links"), data.internalLinks > 0 ? "pass" : "warning", String(data.internalLinks)),
    check("externalLinks", tri("لینک‌های خارجی", "External links", "Externe Links"), "pass", String(data.externalLinks)),
    check("totalLinks", tri("مجموع لینک‌ها", "Total links on page", "Gesamtlinks auf Seite"), data.links < 200 ? "pass" : "warning", String(data.links)),
  ];

  // Crawlability: can search engines find this site, and are they allowed to index it at all?
  const crawl: UrlCheck[] = [];
  const noindexHeader = /noindex/i.test(data.xRobotsTag || "");
  crawl.push(check("indexable", tri("قابل ایندکس بودن", "Indexable", "Indexierbar"), /noindex/i.test(data.robotsMeta) || noindexHeader ? "fail" : "pass",
    /noindex/i.test(data.robotsMeta) ? tri("متا robots شامل noindex است — گوگل این صفحه را ایندکس نمی‌کند", "Meta robots contains noindex — Google will not index this page", "Meta-Robots enthält noindex — Google indexiert diese Seite nicht")
      : noindexHeader ? tri("هدر X-Robots-Tag شامل noindex است", "X-Robots-Tag header contains noindex", "X-Robots-Tag-Header enthält noindex")
      : tri("مانعی برای ایندکس دیده نشد", "Nothing blocks indexing", "Nichts blockiert die Indexierung")));
  if (data.site) {
    const unchecked = tri("بررسی نشد (پاسخ نداد)", "Could not be checked (no response)", "Konnte nicht geprüft werden (keine Antwort)");
    crawl.push(check("robotsTxt", "robots.txt", data.site.robotsTxt !== "found" ? "warning" : data.site.blocksAll ? "fail" : "pass",
      data.site.robotsTxt === "unknown" ? unchecked
        : data.site.robotsTxt === "missing" ? tri("وجود ندارد — به خزنده‌ها قانون خزش و نقشه سایت اعلام نشده است", "Missing — crawlers get no crawl rules and no sitemap pointer", "Fehlt — Crawler erhalten weder Regeln noch einen Sitemap-Hinweis")
        : data.site.blocksAll ? tri("کل سایت را برای خزنده‌ها مسدود کرده (Disallow: /)", "Blocks the entire site for crawlers (Disallow: /)", "Sperrt die gesamte Website für Crawler (Disallow: /)")
        : tri("موجود است", "Present", "Vorhanden")));
    crawl.push(check("sitemap", tri("نقشه سایت (sitemap.xml)", "XML sitemap", "XML-Sitemap"), data.site.sitemap === "found" ? "pass" : "warning",
      data.site.sitemap === "found" ? tri("یافت شد", "Found", "Gefunden")
        : data.site.sitemap === "unknown" ? unchecked
        : tri("یافت نشد — گوگل صفحات جدید را دیرتر کشف می‌کند", "Not found — Google discovers new pages more slowly", "Nicht gefunden — Google entdeckt neue Seiten langsamer")));
  }
  if ((data.hreflangCount ?? 0) > 0) {
    crawl.push(check("hreflang", "hreflang", "pass", tri(`${data.hreflangCount} نسخه زبانی اعلام شده`, `${data.hreflangCount} language versions declared`, `${data.hreflangCount} Sprachversionen deklariert`)));
  }

  const groups: UrlCheckGroup[] = [
    { id: "crawl", titleFa: "خزش و ایندکس", titleEn: "Crawling & Indexing", titleDe: "Crawling & Indexierung", checks: crawl },
    { id: "basic", titleFa: "اطلاعات پایه", titleEn: "Basic Information", titleDe: "Grundinformationen", checks: basic },
    { id: "onpage", titleFa: "سئوی درون‌صفحه", titleEn: "On-page SEO", titleDe: "On-page SEO", checks: onPage },
    { id: "content", titleFa: "کیفیت و نشانه‌گذاری محتوا", titleEn: "Content Quality & Markup", titleDe: "Inhaltsqualität & Markup", checks: content },
    { id: "media", titleFa: "رسانه و بهینه‌سازی تصاویر", titleEn: "Media & Image Optimization", titleDe: "Medien & Bildoptimierung", checks: media },
    { id: "technical", titleFa: "فنی، عملکرد و لینک‌ها", titleEn: "Technical, Performance & Links", titleDe: "Technik, Leistung & Links", checks: technical },
  ];

  // WordPress-specific SEO checks, only for sites that are WordPress (read from the public page source).
  if (data.wp) {
    const w = data.wp;
    const pluginName = ({ yoast: "Yoast SEO", rankmath: "Rank Math", aioseo: "All in One SEO", seopress: "SEOPress" } as const)[w.seoPlugin ?? "yoast"];
    const wpChecks: UrlCheck[] = [
      check("wpSeoPlugin", tri("افزونه سئوی وردپرس", "WordPress SEO plugin", "WordPress-SEO-Plugin"), w.seoPlugin ? "pass" : "warning",
        w.seoPlugin ? pluginName : tri("افزونه سئو پیدا نشد. نصب Yoast SEO یا Rank Math برای مدیریت عنوان، توضیحات و sitemap توصیه می‌شود.", "No SEO plugin detected. Install Yoast SEO or Rank Math to manage titles, descriptions and the sitemap.", "Kein SEO-Plugin erkannt. Installieren Sie Yoast SEO oder Rank Math für Titel, Beschreibungen und Sitemap.")),
      check("wpPermalinks", tri("ساختار پیوند یکتا", "Permalink structure", "Permalink-Struktur"), w.plainPermalinks ? "warning" : "pass",
        w.plainPermalinks ? tri("آدرس‌ها به شکل ?p=123 هستند. در تنظیمات ← پیوندهای یکتا، «نام نوشته» را انتخاب کنید.", "URLs look like ?p=123. In Settings → Permalinks choose “Post name”.", "URLs sehen aus wie ?p=123. Wählen Sie unter Einstellungen → Permalinks „Beitragsname“.") : tri("آدرس‌های خوانا", "Readable URLs", "Lesbare URLs")),
      check("wpVersion", tri("نسخه وردپرس", "WordPress version", "WordPress-Version"), w.versionExposed ? "warning" : "pass",
        w.versionExposed ? tri(`نسخه وردپرس در تگ generator فاش شده است (${w.generator}).`, `The WordPress version is exposed in the generator tag (${w.generator}).`, `Die WordPress-Version steht im Generator-Tag (${w.generator}).`) : tri("نسخه فاش نشده", "Version not exposed", "Version nicht sichtbar")),
      check("wpUncategorized", tri("دسته‌بندی پیش‌فرض", "Default category", "Standardkategorie"), w.uncategorized ? "warning" : "pass",
        w.uncategorized ? tri("مطالب در دسته «Uncategorized» هستند؛ یک دسته‌بندی معنادار بسازید.", "Posts sit in the “Uncategorized” category; create meaningful categories.", "Beiträge liegen in „Uncategorized“; legen Sie sinnvolle Kategorien an.") : tri("دسته‌بندی معنادار", "Meaningful categories", "Sinnvolle Kategorien")),
    ];
    if (/noindex/i.test(data.robotsMeta)) {
      wpChecks.push(check("wpDiscourage", tri("مسدود بودن موتورهای جستجو", "Search engines discouraged", "Suchmaschinen ausgeschlossen"), "fail",
        tri("صفحه noindex است. در وردپرس: تنظیمات ← خواندن ← «درخواست از موتورهای جستجو برای ایندکس نکردن» را خاموش کنید.", "The page is noindex. In WordPress: Settings → Reading → untick “Discourage search engines from indexing this site”.", "Die Seite ist noindex. In WordPress: Einstellungen → Lesen → „Suchmaschinen davon abhalten, diese Website zu indexieren“ deaktivieren.")));
    }
    groups.push({ id: "wordpress", titleFa: "سئوی وردپرس", titleEn: "WordPress SEO", titleDe: "WordPress-SEO", checks: wpChecks });
  }

  const allChecks = groups.flatMap((g) => g.checks);
  const weight: Record<CheckStatus, number> = { pass: 1, warning: 0.5, fail: 0 };
  const score = Math.round((allChecks.reduce((sum, c) => sum + weight[c.status], 0) / allChecks.length) * 100);

  return { score, groups };
}
