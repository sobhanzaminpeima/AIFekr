import { describe, it, expect } from "vitest";
import { decodeEntities, textOfTags, parseRobotsTxt, viewportBlocksZoom } from "./htmlParse";

describe("textOfTags", () => {
  it("reads a heading that wraps inner markup (aifekr.com's own h1)", () => {
    const html = '<h1 class="x" style="opacity:0">An AI Team<!-- --> <span style="a:b">Built for Your Business</span></h1>';
    expect(textOfTags(html, "h1")).toEqual(["An AI Team Built for Your Business"]);
  });
  it("finds several headings and ignores empty ones", () => {
    expect(textOfTags("<h2>One</h2><h2> </h2><h2>Two &amp; three</h2>", "h2")).toEqual(["One", "Two & three"]);
  });
  it("returns nothing when there is none", () => {
    expect(textOfTags("<p>no headings</p>", "h1")).toEqual([]);
  });
});

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("Music &amp; Tools &#39;x&#39; &#x27;y&#x27; &quot;z&quot;")).toBe("Music & Tools 'x' 'y' \"z\"");
  });
  it("leaves unknown entities and bad code points alone", () => {
    expect(decodeEntities("&unknown; &#99999999999;")).toBe("&unknown; ");
  });
});

describe("parseRobotsTxt", () => {
  it("detects a site-wide block for all crawlers", () => {
    expect(parseRobotsTxt("User-agent: *\nDisallow: /").blocksAll).toBe(true);
  });
  it("does not treat a path block as a site-wide block", () => {
    expect(parseRobotsTxt("User-agent: *\nDisallow: /admin\nDisallow: /api/").blocksAll).toBe(false);
  });
  it("ignores blocks aimed at other bots", () => {
    expect(parseRobotsTxt("User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow:").blocksAll).toBe(false);
  });
  it("collects sitemap lines, comments stripped", () => {
    const r = parseRobotsTxt("# hi\nUser-agent: *\nAllow: /\nSitemap: https://a.com/sitemap.xml # main\nSitemap: https://a.com/s2.xml");
    expect(r.sitemaps).toEqual(["https://a.com/sitemap.xml", "https://a.com/s2.xml"]);
    expect(r.blocksAll).toBe(false);
  });
});

describe("viewportBlocksZoom", () => {
  it("flags maximum-scale=1 and user-scalable=no", () => {
    expect(viewportBlocksZoom("width=device-width, initial-scale=1, maximum-scale=1")).toBe(true);
    expect(viewportBlocksZoom("width=device-width, user-scalable=no")).toBe(true);
  });
  it("accepts a zoomable viewport", () => {
    expect(viewportBlocksZoom("width=device-width, initial-scale=1")).toBe(false);
    expect(viewportBlocksZoom("width=device-width, maximum-scale=5")).toBe(false);
  });
});

import { detectWordPress } from "./htmlParse";

describe("detectWordPress", () => {
  const wpHtml = '<html><head><link rel="stylesheet" href="/wp-content/themes/x/style.css"><!-- This site is optimized with the Yoast SEO plugin v22 --></head></html>';
  it("recognises WordPress and the SEO plugin from the page source", () => {
    const s = detectWordPress(wpHtml, ["/about", "/blog/hello"], "WordPress 6.5.2");
    expect(s).toMatchObject({ seoPlugin: "yoast", plainPermalinks: false, uncategorized: false, versionExposed: true });
  });
  it("returns null for a site that is not WordPress", () => {
    expect(detectWordPress("<html><body>hi</body></html>", ["/x"], "")).toBeNull();
    expect(detectWordPress("<html><body>hi</body></html>", ["/x"], "Hugo 0.120")).toBeNull();
  });
  it("finds Rank Math, All in One SEO and SEOPress", () => {
    expect(detectWordPress('<link href="/wp-content/x"><!-- Rank Math SEO plugin -->', [], "")?.seoPlugin).toBe("rankmath");
    expect(detectWordPress('<link href="/wp-content/x"><!-- All in One SEO 4 -->', [], "")?.seoPlugin).toBe("aioseo");
    expect(detectWordPress('<link href="/wp-content/x"><!-- SEOPress -->', [], "")?.seoPlugin).toBe("seopress");
  });
  it("reports no SEO plugin when none left a fingerprint", () => {
    expect(detectWordPress('<link href="/wp-content/x">', [], "WordPress")?.seoPlugin).toBeNull();
  });
  it("flags plain permalinks, the Uncategorized category and a hidden version", () => {
    const s = detectWordPress('<link href="/wp-content/x">', ["/?p=123", "/category/uncategorized/"], "WordPress");
    expect(s).toMatchObject({ plainPermalinks: true, uncategorized: true, versionExposed: false });
  });
});
