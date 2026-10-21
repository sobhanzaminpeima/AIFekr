import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/net/safeUrl", () => ({ safeFetch: vi.fn(), UnsafeUrlError: class extends Error {} }));

import { mobileIssues, mobileOnlyRegressions } from "./mobileCore";
import type { CrawledPageData } from "./urlAudit";

const page = (over: Partial<CrawledPageData> = {}): CrawledPageData => ({
  title: "Home", metaDesc: "d", metaKeywords: "", canonical: "", ogTitle: "", ogDesc: "", ogImage: "", robotsMeta: "", viewport: "width=device-width, initial-scale=1", charset: "utf-8", langAttr: "en",
  h1: ["Hello"], h2: [], h3Count: 0, images: 0, imagesWithAlt: 0, lazyImages: 0, links: 0, internalLinks: 0, externalLinks: 0, wordCount: 500, hasSchema: false, hasFavicon: true, isHttps: true,
  hasDeprecatedTags: false, hasInlineCss: false, htmlSize: 60_000, doctype: true, server: null, responseTimeMs: 400, statusCode: 200, finalUrl: "https://a.com/", ...over,
});
const ids = (l: { id: string }[]) => l.map((i) => i.id);

describe("mobileIssues", () => {
  it("reports nothing when the phone gets the same good page", () => {
    expect(mobileIssues(page(), page(), "https://a.com/", "en")).toEqual([]);
  });
  it("fails a page that is noindex for phones only (mobile-first indexing would drop it)", () => {
    const r = mobileIssues(page(), page({ robotsMeta: "noindex" }), "https://a.com/", "en");
    expect(r).toEqual([expect.objectContaining({ id: "mobile_noindex", status: "fail" })]);
  });
  it("does not blame the phone when desktop is noindex too", () => {
    expect(ids(mobileIssues(page({ robotsMeta: "noindex" }), page({ robotsMeta: "noindex" }), "https://a.com/", "en"))).not.toContain("mobile_noindex");
  });
  it("flags a missing mobile H1 and thin mobile content", () => {
    const r = mobileIssues(page(), page({ h1: [], wordCount: 200 }), "https://a.com/", "en");
    expect(ids(r)).toEqual(["mobile_h1", "mobile_content"]);
  });
  it("does not compare content on tiny pages", () => {
    expect(ids(mobileIssues(page({ wordCount: 100 }), page({ wordCount: 20 }), "https://a.com/", "en"))).not.toContain("mobile_content");
  });
  it("flags a different mobile title and a separate mobile host", () => {
    const r = mobileIssues(page(), page({ title: "Mobile home", finalUrl: "https://m.a.com/" }), "https://a.com/", "en");
    expect(ids(r)).toEqual(["mobile_title", "mobile_redirect"]);
    expect(r.every((i) => i.label.startsWith("📱"))).toBe(true);
  });
  it("treats www and the bare domain as the same host", () => {
    expect(ids(mobileIssues(page(), page({ finalUrl: "https://www.a.com/" }), "https://a.com/", "en"))).not.toContain("mobile_redirect");
  });
  it("grades slow and heavy mobile responses", () => {
    expect(mobileIssues(page(), page({ responseTimeMs: 3000 }), "https://a.com/", "en")[0]).toMatchObject({ id: "mobile_speed", status: "warning" });
    expect(mobileIssues(page(), page({ responseTimeMs: 5000 }), "https://a.com/", "en")[0]).toMatchObject({ id: "mobile_speed", status: "fail" });
    expect(ids(mobileIssues(page(), page({ htmlSize: 500_000 }), "https://a.com/", "en"))).toEqual(["mobile_size"]);
  });
  it("writes the messages in the requested language", () => {
    expect(mobileIssues(page(), page({ h1: [] }), "https://a.com/", "fa")[0].detail).toContain("موبایل");
    expect(mobileIssues(page(), page({ h1: [] }), "https://a.com/", "de")[0].detail).toContain("mobile");
  });
});

describe("mobileOnlyRegressions", () => {
  it("keeps only checks that fail on the phone but pass on desktop", () => {
    const desktop = [{ id: "viewportZoom", status: "pass" }, { id: "title", status: "warning" }];
    const mobile = [
      { id: "viewportZoom", label: "Zoom", status: "fail", detail: "no viewport" },
      { id: "title", label: "Title", status: "warning", detail: "short" },
      { id: "responseTime", label: "Resp", status: "warning", detail: "slow" },
    ];
    expect(mobileOnlyRegressions(desktop, mobile)).toEqual([{ id: "mobile_viewportZoom", label: "📱 Zoom", status: "fail", detail: "no viewport" }]);
  });
});
