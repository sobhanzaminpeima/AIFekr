import { safeFetch } from "@/lib/net/safeUrl";
import { crawlUrlDetailed, auditUrlPage, type CrawlFailure, type UrlCheckGroup } from "@/lib/seo/urlAudit";
import { parseSitemapLocs, pickPages, MAX_PAGES_PER_AUDIT, type StoredPage, type StoredIssue } from "@/lib/seo/siteAuditCore";

export interface SiteAuditResult {
  score: number;
  pagesCrawled: number;
  failCount: number;
  warnCount: number;
  passCount: number;
  pages: StoredPage[];
  /** Site-wide problems (robots.txt, sitemap, hreflang), taken from the homepage probe. */
  siteIssues: StoredIssue[];
}

const SITE_LEVEL_CHECKS = new Set(["robotsTxt", "sitemap", "hreflang"]);
const TIME_BUDGET_MS = 55_000;
const CONCURRENCY = 3;

async function fetchText(url: string): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    const res = await safeFetch(url, { signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; AiFekrSEOBot/1.0)" } });
    const text = res.status === 200 ? (await res.text()).slice(0, 500_000) : null;
    clearTimeout(t);
    return text;
  } catch { return null; }
}

/** Page URLs the site itself declares in sitemap.xml (one level of sitemap index followed). */
async function sitemapUrls(origin: string): Promise<string[]> {
  const xml = await fetchText(origin + "/sitemap.xml");
  if (!xml || !/<(urlset|sitemapindex)\b/i.test(xml)) return [];
  const first = parseSitemapLocs(xml);
  if (first.pages.length || !first.childSitemaps.length) return first.pages;
  const child = await fetchText(first.childSitemaps[0]);
  return child ? parseSitemapLocs(child).pages : [];
}

function summarizeGroups(groups: UrlCheckGroup[]) {
  let fail = 0, warn = 0, pass = 0;
  const issues: StoredIssue[] = [];
  for (const g of groups) {
    for (const c of g.checks) {
      if (c.status === "pass") pass++;
      else {
        if (c.status === "fail") fail++; else warn++;
        issues.push({ id: c.id, label: c.label, status: c.status, detail: c.detail.slice(0, 240) });
      }
    }
  }
  return { fail, warn, pass, issues };
}

export type SiteAuditOutcome = { ok: true; result: SiteAuditResult } | { ok: false; failure: CrawlFailure };

/**
 * Audits a site: the homepage, then up to MAX_PAGES_PER_AUDIT-1 more pages taken
 * from its own sitemap (or, failing that, its internal links). Only the homepage
 * failing aborts the audit; another page that errors is recorded as a finding.
 */
export async function runSiteAudit(homeUrl: string, lang: "fa" | "en" | "de" | "tr", maxPages = MAX_PAGES_PER_AUDIT): Promise<SiteAuditOutcome> {
  const started = Date.now();
  const home = await crawlUrlDetailed(homeUrl, { probeSite: true });
  if (!("data" in home)) return { ok: false, failure: home };

  const origin = new URL(homeUrl).origin;
  const declared = await sitemapUrls(origin);
  const targets = pickPages(homeUrl, declared, home.data.linkTargets ?? [], maxPages);

  const pages: StoredPage[] = [];
  const siteIssues: StoredIssue[] = [];
  let fail = 0, warn = 0, pass = 0;

  const record = (url: string, data: Parameters<typeof auditUrlPage>[0], isHome: boolean) => {
    const { score, groups } = auditUrlPage(data, url, lang);
    const s = summarizeGroups(groups);
    // Site-wide findings belong to the site, not to every page.
    const pageIssues = s.issues.filter((i) => !SITE_LEVEL_CHECKS.has(i.id));
    if (isHome) for (const i of s.issues) if (SITE_LEVEL_CHECKS.has(i.id)) siteIssues.push(i);
    fail += s.fail; warn += s.warn; pass += s.pass;
    pages.push({ url, score, statusCode: data.statusCode, title: data.title, h1Count: data.h1.length, wordCount: data.wordCount, responseMs: data.responseTimeMs, issues: pageIssues });
  };

  record(homeUrl, home.data, true);

  const rest = targets.filter((u) => u.replace(/\/$/, "") !== homeUrl.replace(/\/$/, ""));
  let cursor = 0;
  const worker = async () => {
    while (cursor < rest.length && Date.now() - started < TIME_BUDGET_MS) {
      const url = rest[cursor++];
      const r = await crawlUrlDetailed(url, { probeSite: false });
      if ("data" in r) { record(url, r.data, false); continue; }
      // A page the sitemap/links promise but that errors is itself a real finding; timeouts are treated as transient.
      if (r.reason === "http") {
        fail++;
        pages.push({ url, score: 0, statusCode: r.status, title: "", h1Count: 0, wordCount: 0, responseMs: 0, issues: [{ id: "httpStatus", label: "HTTP status", status: "fail", detail: `HTTP ${r.status}` }] });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rest.length) }, worker));

  const score = pages.length ? Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length) : 0;
  return { ok: true, result: { score, pagesCrawled: pages.length, failCount: fail, warnCount: warn, passCount: pass, pages, siteIssues } };
}
