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
}

export async function crawlUrl(url: string): Promise<CrawledPageData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const start = Date.now();
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; AiFekrSEOBot/1.0)" } });
    const responseTimeMs = Date.now() - start;
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();

    const getTag = (p: RegExp) => { const m = html.match(p); return m ? m[1]?.trim() || "" : ""; };
    const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);
    const metaDesc = getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const metaKeywords = getTag(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i);
    const canonical = getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    const ogTitle = getTag(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    const ogDesc = getTag(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
    const ogImage = getTag(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
    const robotsMeta = getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
    const viewport = getTag(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["']/i);
    const charset = getTag(/<meta[^>]*charset=["']?([\w-]+)["']?/i);
    const langAttr = getTag(/<html[^>]*\slang=["']([^"']*)["']/i);
    const h1s = Array.from(html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/gi)).map((m) => m[1].trim()).filter(Boolean);
    const h2s = Array.from(html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/gi)).map((m) => m[1].trim()).filter(Boolean);
    const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
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

    return {
      title, metaDesc, metaKeywords, canonical, ogTitle, ogDesc, ogImage, robotsMeta, viewport, charset, langAttr,
      h1: h1s.slice(0, 5), h2: h2s.slice(0, 10), h3Count,
      images, imagesWithAlt, lazyImages, links, internalLinks, externalLinks, wordCount,
      hasSchema, hasFavicon, isHttps, hasDeprecatedTags, hasInlineCss, htmlSize: html.length, doctype,
      server, responseTimeMs, statusCode: res.status,
    };
  } catch {
    return null;
  }
}

export type CheckStatus = "pass" | "warning" | "fail";
export interface UrlCheck { id: string; label: string; status: CheckStatus; detail: string; }
export interface UrlCheckGroup { id: string; titleFa: string; titleEn: string; checks: UrlCheck[]; }

export function auditUrlPage(data: CrawledPageData, url: string, lang: "fa" | "en"): { score: number; groups: UrlCheckGroup[] } {
  const isFa = lang === "fa";
  const check = (id: string, label: string, status: CheckStatus, detail: string): UrlCheck => ({ id, label, status, detail });

  const basic: UrlCheck[] = [
    check("statusCode", isFa ? "کد وضعیت HTTP" : "HTTP status code", data.statusCode === 200 ? "pass" : "warning", String(data.statusCode)),
    check("https", isFa ? "HTTPS" : "HTTPS", data.isHttps ? "pass" : "fail", data.isHttps ? (isFa ? "سایت از HTTPS استفاده می‌کند" : "Site uses HTTPS") : (isFa ? "سایت HTTPS ندارد" : "Site does not use HTTPS")),
    check("doctype", isFa ? "اعلان Doctype" : "Doctype declaration", data.doctype ? "pass" : "warning", data.doctype ? "<!DOCTYPE html>" : (isFa ? "یافت نشد" : "Not found")),
    check("charset", isFa ? "کدگذاری کاراکتر" : "Meta charset", data.charset ? "pass" : "warning", data.charset || (isFa ? "یافت نشد" : "Not found")),
    check("lang", isFa ? "ویژگی زبان" : "Language attribute", data.langAttr ? "pass" : "warning", data.langAttr || (isFa ? "یافت نشد" : "Not found")),
    check("favicon", isFa ? "فاوآیکون" : "Favicon", data.hasFavicon ? "pass" : "warning", data.hasFavicon ? (isFa ? "موجود است" : "Present") : (isFa ? "یافت نشد" : "Not found")),
    check("responseTime", isFa ? "زمان پاسخ سرور" : "Server response time", data.responseTimeMs < 800 ? "pass" : data.responseTimeMs < 2000 ? "warning" : "fail", `${data.responseTimeMs}ms`),
    check("server", isFa ? "امضای سرور" : "Server signature", data.server ? "warning" : "pass", data.server ? (isFa ? `افشا شده: ${data.server}` : `Exposed: ${data.server}`) : (isFa ? "افشا نشده" : "Not exposed")),
  ];

  const onPage: UrlCheck[] = [
    check("title", isFa ? "تگ Title" : "Title tag", !data.title ? "fail" : data.title.length >= 30 && data.title.length <= 65 ? "pass" : "warning", data.title ? `"${data.title}" (${data.title.length} ${isFa ? "کاراکتر" : "chars"})` : (isFa ? "یافت نشد" : "Missing")),
    check("metaDesc", isFa ? "توضیحات متا" : "Meta description", !data.metaDesc ? "fail" : data.metaDesc.length >= 110 && data.metaDesc.length <= 165 ? "pass" : "warning", data.metaDesc ? `${data.metaDesc.length} ${isFa ? "کاراکتر" : "chars"}` : (isFa ? "یافت نشد" : "Missing")),
    check("h1", isFa ? "تگ H1" : "H1 tag", data.h1.length === 1 ? "pass" : data.h1.length === 0 ? "fail" : "warning", data.h1.length === 0 ? (isFa ? "یافت نشد" : "Missing") : data.h1.length > 1 ? (isFa ? `${data.h1.length} عدد H1 — باید فقط یکی باشد` : `${data.h1.length} H1 tags — should be exactly one`) : data.h1[0]),
    check("headingStructure", isFa ? "ساختار هدینگ‌ها" : "Heading structure", data.h2.length > 0 ? "pass" : "warning", isFa ? `${data.h2.length} تگ H2، ${data.h3Count} تگ H3` : `${data.h2.length} H2 tags, ${data.h3Count} H3 tags`),
    check("canonical", isFa ? "تگ Canonical" : "Canonical tag", data.canonical ? "pass" : "warning", data.canonical || (isFa ? "یافت نشد" : "Not found")),
    check("metaKeywords", isFa ? "متا کلمات کلیدی" : "Meta keywords", "pass", data.metaKeywords ? data.metaKeywords.slice(0, 80) : (isFa ? "استفاده نشده (اختیاری است)" : "Not used (optional)")),
    check("robotsMeta", isFa ? "متا Robots" : "Meta robots", /noindex/i.test(data.robotsMeta) ? "fail" : "pass", data.robotsMeta || (isFa ? "پیش‌فرض (index, follow)" : "Default (index, follow)")),
    check("seoUrl", isFa ? "URL مناسب سئو" : "SEO-friendly URL", /^https?:\/\/[^?]+$/.test(url) && !/[A-Z]/.test(new URL(url).pathname) ? "pass" : "warning", url),
  ];

  const content: UrlCheck[] = [
    check("wordCount", isFa ? "تعداد کلمات" : "Word count", data.wordCount >= 300 ? "pass" : "warning", String(data.wordCount)),
    check("schema", isFa ? "داده ساختاریافته (Schema)" : "Structured data (Schema)", data.hasSchema ? "pass" : "warning", data.hasSchema ? (isFa ? "یافت شد" : "Found") : (isFa ? "یافت نشد" : "Not found")),
    check("ogTags", isFa ? "برچسب‌های OpenGraph" : "OpenGraph tags", data.ogTitle && data.ogDesc ? "pass" : "warning", `og:title ${data.ogTitle ? "✓" : "✗"}, og:description ${data.ogDesc ? "✓" : "✗"}, og:image ${data.ogImage ? "✓" : "✗"}`),
    check("deprecatedTags", isFa ? "تگ‌های منسوخ HTML" : "Deprecated HTML tags", data.hasDeprecatedTags ? "warning" : "pass", data.hasDeprecatedTags ? (isFa ? "یافت شد (font/center/marquee)" : "Found (font/center/marquee)") : (isFa ? "یافت نشد" : "None found")),
    check("inlineCss", isFa ? "CSS درون‌خطی" : "Inline CSS", data.hasInlineCss ? "warning" : "pass", data.hasInlineCss ? (isFa ? "استفاده شده — روی سرعت اثر می‌گذارد" : "In use — affects performance") : (isFa ? "استفاده نشده" : "Not used")),
  ];

  const media: UrlCheck[] = [
    check("imageAlt", isFa ? "برچسب Alt تصاویر" : "Image ALT attributes", data.images === 0 ? "pass" : data.imagesWithAlt === data.images ? "pass" : data.imagesWithAlt > 0 ? "warning" : "fail", isFa ? `${data.imagesWithAlt} از ${data.images} تصویر دارای alt` : `${data.imagesWithAlt} of ${data.images} images have alt`),
    check("lazyLoading", isFa ? "بارگذاری تنبل تصاویر" : "Lazy loading images", data.images === 0 ? "pass" : data.lazyImages > 0 ? "pass" : "warning", isFa ? `${data.lazyImages} از ${data.images} تصویر با lazy loading` : `${data.lazyImages} of ${data.images} images use lazy loading`),
  ];

  const technical: UrlCheck[] = [
    check("htmlSize", isFa ? "حجم صفحه" : "Page size", data.htmlSize < 200000 ? "pass" : data.htmlSize < 500000 ? "warning" : "fail", `${Math.round(data.htmlSize / 1024)} KB`),
    check("internalLinks", isFa ? "لینک‌های داخلی" : "Internal links", data.internalLinks > 0 ? "pass" : "warning", String(data.internalLinks)),
    check("externalLinks", isFa ? "لینک‌های خارجی" : "External links", "pass", String(data.externalLinks)),
    check("totalLinks", isFa ? "مجموع لینک‌ها" : "Total links on page", data.links < 200 ? "pass" : "warning", String(data.links)),
  ];

  const groups: UrlCheckGroup[] = [
    { id: "basic", titleFa: "اطلاعات پایه", titleEn: "Basic Information", checks: basic },
    { id: "onpage", titleFa: "سئوی درون‌صفحه", titleEn: "On-page SEO", checks: onPage },
    { id: "content", titleFa: "کیفیت و نشانه‌گذاری محتوا", titleEn: "Content Quality & Markup", checks: content },
    { id: "media", titleFa: "رسانه و بهینه‌سازی تصاویر", titleEn: "Media & Image Optimization", checks: media },
    { id: "technical", titleFa: "فنی، عملکرد و لینک‌ها", titleEn: "Technical, Performance & Links", checks: technical },
  ];

  const allChecks = groups.flatMap((g) => g.checks);
  const weight: Record<CheckStatus, number> = { pass: 1, warning: 0.5, fail: 0 };
  const score = Math.round((allChecks.reduce((sum, c) => sum + weight[c.status], 0) / allChecks.length) * 100);

  return { score, groups };
}
