/**
 * Small, dependency-free HTML/robots helpers for the SEO auditor. Kept apart
 * from the crawler so they can be unit-tested without any network.
 */

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»" };

/** Decodes the entities that appear in titles/descriptions (&amp;, &#39;, &#x27;, ...). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

function safeCodePoint(n: number): string {
  try { return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; } catch { return ""; }
}

/**
 * Visible text of every <tag>...</tag>, INCLUDING headings that wrap inner
 * markup. The old `<h1[^>]*>([^<]*)</h1>` pattern returned nothing for
 * `<h1>Build <span>faster</span></h1>` -- so aifekr.com's own landing page,
 * which has exactly that h1, was reported as "H1 missing".
 */
export function textOfTags(html: string, tag: "h1" | "h2" | "h3"): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  for (const m of Array.from(html.matchAll(re))) {
    const text = decodeEntities(m[1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

export interface RobotsTxtInfo {
  /** `User-agent: *` (or ours) has `Disallow: /` -- the whole site is closed to crawlers. */
  blocksAll: boolean;
  sitemaps: string[];
}

export function parseRobotsTxt(text: string): RobotsTxtInfo {
  const sitemaps: string[] = [];
  let blocksAll = false;
  let applies = false;
  let sawRuleInGroup = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "sitemap") { if (value) sitemaps.push(value); continue; }
    if (key === "user-agent") {
      if (sawRuleInGroup) { applies = false; sawRuleInGroup = false; }
      if (value === "*" || /aifekrseobot/i.test(value)) applies = true;
      continue;
    }
    sawRuleInGroup = true;
    if (applies && key === "disallow" && value === "/") blocksAll = true;
    if (applies && key === "allow" && value === "/") blocksAll = false;
  }
  return { blocksAll, sitemaps };
}

/** True when the viewport meta prevents pinch-zoom -- an accessibility failure and a mobile-usability flag. */
export function viewportBlocksZoom(viewport: string): boolean {
  const v = viewport.toLowerCase().replace(/\s+/g, "");
  if (/user-scalable=(no|0)/.test(v)) return true;
  const max = v.match(/maximum-scale=([\d.]+)/);
  return !!max && parseFloat(max[1]) < 2;
}
