/**
 * Pure logic for the SEO Command Center's saved audits: which pages to crawl,
 * how an audit is summarised and stored, what changed since the last audit and
 * when the next scheduled audit is due. No network or database access here, so
 * it is fully unit-testable; the crawling lives in siteAudit.ts.
 */
export type IssueStatus = "warning" | "fail";

export interface StoredIssue { id: string; label: string; status: IssueStatus; detail: string }

export interface StoredPage {
  url: string;
  score: number;
  statusCode: number;
  title: string;
  h1Count: number;
  wordCount: number;
  responseMs: number;
  /** Score of this page as a phone sees it (mobile user agent); undefined when the mobile crawl was skipped or failed. */
  mobileScore?: number;
  /** Only non-passing checks are stored (keeps an audit small); mobile-specific ones have ids starting "mobile_". */
  issues: StoredIssue[];
}

export interface AuditSnapshot { score: number; pages: StoredPage[]; siteIssues: StoredIssue[] }

export const MAX_PAGES_PER_AUDIT = 10;

const NON_HTML = /\.(jpe?g|png|gif|webp|svg|ico|css|js|json|xml|pdf|zip|mp4|mp3|woff2?|ttf|txt)$/i;

/** Same-origin, fragment-free, non-asset URL, or null. */
export function normalizePageUrl(raw: string, origin: string): string | null {
  let u: URL;
  try { u = new URL(raw, origin); } catch { return null; }
  if (u.origin !== new URL(origin).origin) return null;
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (NON_HTML.test(u.pathname)) return null;
  u.hash = "";
  return u.toString();
}

/** <loc> entries of a sitemap or sitemap index. */
export function parseSitemapLocs(xml: string): { pages: string[]; childSitemaps: string[] } {
  const pages: string[] = [];
  const childSitemaps: string[] = [];
  const isIndex = /<sitemapindex\b/i.test(xml);
  for (const m of Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi))) {
    const loc = m[1].replace(/&amp;/g, "&");
    (isIndex ? childSitemaps : pages).push(loc);
  }
  return { pages, childSitemaps };
}

/** Homepage first, then sitemap URLs, then internal links -- deduplicated, capped. */
export function pickPages(homeUrl: string, sitemapUrls: string[], linkTargets: string[], max = MAX_PAGES_PER_AUDIT): string[] {
  const origin = new URL(homeUrl).origin;
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const n = normalizePageUrl(raw, origin);
    if (!n) return;
    // "/" and "/index" style duplicates of the homepage, and trailing-slash twins, count once.
    const key = n.replace(/\/$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };
  add(homeUrl);
  for (const u of sitemapUrls) { if (out.length >= max) break; add(u); }
  for (const u of linkTargets) { if (out.length >= max) break; add(u); }
  return out.slice(0, max);
}

export function nextAuditDate(frequency: string, from: Date): Date {
  const days = frequency === "daily" ? 1 : frequency === "monthly" ? 30 : 7;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface IssueRef { scope: string; id: string; label: string; status: IssueStatus }

export interface AuditDiff {
  scoreDelta: number;
  fixed: IssueRef[];
  added: IssueRef[];
  /** Issues present in both audits (still open). */
  remaining: number;
}

const refsOf = (snap: AuditSnapshot, onlyUrls?: Set<string>): Map<string, IssueRef> => {
  const m = new Map<string, IssueRef>();
  for (const i of snap.siteIssues) m.set(`site|${i.id}`, { scope: "site", id: i.id, label: i.label, status: i.status });
  for (const p of snap.pages) {
    if (onlyUrls && !onlyUrls.has(p.url)) continue;
    for (const i of p.issues) m.set(`${p.url}|${i.id}`, { scope: p.url, id: i.id, label: i.label, status: i.status });
  }
  return m;
};

/**
 * What changed between two audits. Page-level issues are compared only for pages
 * both audits crawled, so a page that was simply not sampled this time is never
 * reported as "fixed".
 */
export function diffAudits(prev: AuditSnapshot, curr: AuditSnapshot): AuditDiff {
  const prevUrls = new Set(prev.pages.map((p) => p.url));
  const shared = new Set(curr.pages.map((p) => p.url).filter((u) => prevUrls.has(u)));
  const before = refsOf(prev, shared);
  const after = refsOf(curr, shared);
  const fixed: IssueRef[] = [];
  const added: IssueRef[] = [];
  let remaining = 0;
  before.forEach((ref, key) => { if (!after.has(key)) fixed.push(ref); else remaining++; });
  after.forEach((ref, key) => { if (!before.has(key)) added.push(ref); });
  const severity = (r: IssueRef) => (r.status === "fail" ? 0 : 1);
  fixed.sort((a, b) => severity(a) - severity(b));
  added.sort((a, b) => severity(a) - severity(b));
  return { scoreDelta: curr.score - prev.score, fixed, added, remaining };
}

/** Whether a scheduled audit found something worth an email: a real drop, or a new hard failure. */
export function isNotable(diff: AuditDiff): boolean {
  return diff.scoreDelta <= -5 || diff.added.some((i) => i.status === "fail");
}
