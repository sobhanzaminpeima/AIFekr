import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/net/safeUrl", () => ({ safeFetch: vi.fn(), UnsafeUrlError: class extends Error {} }));

import { auditUrlPage, type CrawledPageData } from "./urlAudit";

const base: CrawledPageData = {
  title: "AiFekr — AI Agents for Your Business | Chat, Image & CRM", metaDesc: "x".repeat(140), metaKeywords: "", canonical: "https://a.com/", ogTitle: "t", ogDesc: "d", ogImage: "i",
  robotsMeta: "", viewport: "width=device-width, initial-scale=1", charset: "utf-8", langAttr: "en", h1: ["Hello"], h2: ["a"], h3Count: 0, images: 0, imagesWithAlt: 0, lazyImages: 0,
  links: 10, internalLinks: 8, externalLinks: 2, wordCount: 500, hasSchema: true, hasFavicon: true, isHttps: true, hasDeprecatedTags: false, hasInlineCss: false, htmlSize: 50_000,
  doctype: true, server: "cloudflare", responseTimeMs: 300, statusCode: 200, twitterCard: "summary_large_image", hreflangCount: 0,
  site: { robotsTxt: "found", blocksAll: false, sitemap: "found" },
};

const find = (d: CrawledPageData, id: string) => auditUrlPage(d, "https://a.com/", "en").groups.flatMap((g) => g.checks).find((c) => c.id === id)!;

describe("auditUrlPage crawlability", () => {
  it("passes a healthy site", () => {
    for (const id of ["indexable", "robotsTxt", "sitemap", "viewportZoom", "twitterCard", "server"]) expect(find(base, id).status).toBe("pass");
  });
  it("flags a missing robots.txt and sitemap (what aifekr.com itself was missing)", () => {
    const d = { ...base, site: { robotsTxt: "missing" as const, blocksAll: false, sitemap: "missing" as const } };
    expect(find(d, "robotsTxt").status).toBe("warning");
    expect(find(d, "sitemap").status).toBe("warning");
  });
  it("fails a site whose robots.txt blocks everything", () => {
    expect(find({ ...base, site: { robotsTxt: "found", blocksAll: true, sitemap: "found" } }, "robotsTxt").status).toBe("fail");
  });
  it("fails a noindex page, by meta tag or by header", () => {
    expect(find({ ...base, robotsMeta: "noindex" }, "indexable").status).toBe("fail");
    expect(find({ ...base, xRobotsTag: "noindex, nofollow" }, "indexable").status).toBe("fail");
  });
  it("warns when the viewport blocks zoom, fails when there is none", () => {
    expect(find({ ...base, viewport: "width=device-width, maximum-scale=1" }, "viewportZoom").status).toBe("warning");
    expect(find({ ...base, viewport: "" }, "viewportZoom").status).toBe("fail");
  });
  it("does not call a CDN name a security leak, but still flags a real server banner", () => {
    expect(find({ ...base, server: "cloudflare" }, "server").status).toBe("pass");
    expect(find({ ...base, server: "Apache/2.4.41 (Ubuntu)" }, "server").status).toBe("warning");
  });
  it("skips the site-level checks when the probe did not run", () => {
    const ids = auditUrlPage({ ...base, site: undefined }, "https://a.com/", "en").groups.flatMap((g) => g.checks).map((c) => c.id);
    expect(ids).not.toContain("robotsTxt");
    expect(ids).toContain("indexable");
  });
});
