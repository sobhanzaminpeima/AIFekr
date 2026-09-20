import { describe, it, expect } from "vitest";
import { normalizePageUrl, parseSitemapLocs, pickPages, nextAuditDate, diffAudits, isNotable, type AuditSnapshot, type StoredIssue } from "./siteAuditCore";

const issue = (id: string, status: "fail" | "warning" = "warning"): StoredIssue => ({ id, label: id, status, detail: "" });
const page = (url: string, issues: StoredIssue[] = []) => ({ url, score: 80, statusCode: 200, title: "t", h1Count: 1, wordCount: 300, responseMs: 100, issues });
const snap = (score: number, pages: ReturnType<typeof page>[], siteIssues: StoredIssue[] = []): AuditSnapshot => ({ score, pages, siteIssues });

describe("normalizePageUrl", () => {
  it("keeps same-origin html pages and drops fragments", () => {
    expect(normalizePageUrl("/about#team", "https://a.com/")).toBe("https://a.com/about");
    expect(normalizePageUrl("https://a.com/blog/post-1", "https://a.com/")).toBe("https://a.com/blog/post-1");
  });
  it("rejects other origins, assets and non-web schemes", () => {
    expect(normalizePageUrl("https://b.com/x", "https://a.com/")).toBeNull();
    expect(normalizePageUrl("/logo.png", "https://a.com/")).toBeNull();
    expect(normalizePageUrl("/file.pdf", "https://a.com/")).toBeNull();
    expect(normalizePageUrl("mailto:x@a.com", "https://a.com/")).toBeNull();
  });
});

describe("parseSitemapLocs", () => {
  it("reads urlset locations and decodes &amp;", () => {
    const r = parseSitemapLocs("<urlset><url><loc>https://a.com/x?a=1&amp;b=2</loc></url><url><loc> https://a.com/y </loc></url></urlset>");
    expect(r.pages).toEqual(["https://a.com/x?a=1&b=2", "https://a.com/y"]);
    expect(r.childSitemaps).toEqual([]);
  });
  it("recognises a sitemap index", () => {
    const r = parseSitemapLocs("<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>");
    expect(r.childSitemaps).toEqual(["https://a.com/s1.xml"]);
    expect(r.pages).toEqual([]);
  });
});

describe("pickPages", () => {
  it("puts the homepage first, prefers sitemap URLs, dedupes and caps", () => {
    const pages = pickPages("https://a.com/", ["https://a.com/", "https://a.com/a", "https://a.com/b/"], ["/b", "/c", "https://other.com/z"], 4);
    expect(pages).toEqual(["https://a.com/", "https://a.com/a", "https://a.com/b/", "https://a.com/c"]);
  });
  it("falls back to internal links when there is no sitemap", () => {
    expect(pickPages("https://a.com/", [], ["/pricing", "/about"], 10)).toEqual(["https://a.com/", "https://a.com/pricing", "https://a.com/about"]);
  });
});

describe("nextAuditDate", () => {
  const from = new Date("2026-01-01T00:00:00Z");
  it("schedules by frequency", () => {
    expect(nextAuditDate("daily", from).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(nextAuditDate("weekly", from).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(nextAuditDate("monthly", from).toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(nextAuditDate("unknown", from).toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});

describe("diffAudits", () => {
  it("reports fixed and newly introduced issues and the score change", () => {
    const prev = snap(70, [page("https://a.com/", [issue("title"), issue("h1", "fail")])], [issue("sitemap")]);
    const curr = snap(82, [page("https://a.com/", [issue("title"), issue("canonical")])], []);
    const d = diffAudits(prev, curr);
    expect(d.scoreDelta).toBe(12);
    expect(d.fixed.map((i) => i.id).sort()).toEqual(["h1", "sitemap"]);
    expect(d.fixed[0].status).toBe("fail"); // hard failures listed first
    expect(d.added.map((i) => i.id)).toEqual(["canonical"]);
    expect(d.remaining).toBe(1);
  });
  it("does not call an issue fixed just because its page was not sampled this time", () => {
    const prev = snap(70, [page("https://a.com/", []), page("https://a.com/old", [issue("title")])]);
    const curr = snap(70, [page("https://a.com/", []), page("https://a.com/new", [issue("h1")])]);
    const d = diffAudits(prev, curr);
    expect(d.fixed).toEqual([]);
    expect(d.added).toEqual([]);
  });
});

describe("isNotable", () => {
  it("flags a score drop of 5+ or a new hard failure only", () => {
    expect(isNotable({ scoreDelta: -6, fixed: [], added: [], remaining: 0 })).toBe(true);
    expect(isNotable({ scoreDelta: 0, fixed: [], added: [{ scope: "site", id: "x", label: "x", status: "fail" }], remaining: 0 })).toBe(true);
    expect(isNotable({ scoreDelta: -2, fixed: [], added: [{ scope: "site", id: "x", label: "x", status: "warning" }], remaining: 0 })).toBe(false);
  });
});
