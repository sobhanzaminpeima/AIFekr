import { describe, it, expect } from "vitest";
import { detectSeoPlugin, seoMetaFor, confirmMeta, slugFromUrl, editUrlFor, summarizeApplication } from "./core";

describe("detectSeoPlugin", () => {
  it("recognises Yoast and Rank Math from the REST namespaces", () => {
    expect(detectSeoPlugin(["wp/v2", "yoast/v1", "oembed/1.0"])).toBe("yoast");
    expect(detectSeoPlugin(["wp/v2", "rankmath/v1"])).toBe("rankmath");
    expect(detectSeoPlugin(["wp/v2", "wc/v3"])).toBeNull();
  });
});

describe("seoMetaFor", () => {
  it("maps title/description/keyword to each plugin's own meta keys", () => {
    expect(seoMetaFor("yoast", { title: "T", description: "D", focusKeyword: "K" })).toEqual({ _yoast_wpseo_title: "T", _yoast_wpseo_metadesc: "D", _yoast_wpseo_focuskw: "K" });
    expect(seoMetaFor("rankmath", { title: "T", description: "D" })).toEqual({ rank_math_title: "T", rank_math_description: "D" });
  });
  it("sends nothing when there is no plugin or no value", () => {
    expect(seoMetaFor(null, { title: "T" })).toEqual({});
    expect(seoMetaFor("yoast", {})).toEqual({});
  });
});

describe("confirmMeta", () => {
  const sent = { _yoast_wpseo_title: "New title", _yoast_wpseo_metadesc: "New description" };
  it("only confirms keys that come back with the value we sent", () => {
    expect(confirmMeta(sent, { _yoast_wpseo_title: "New title", _yoast_wpseo_metadesc: "old" })).toEqual({ _yoast_wpseo_title: "confirmed", _yoast_wpseo_metadesc: "not_confirmed" });
  });
  it("treats keys WordPress dropped (not registered for REST) as not confirmed", () => {
    expect(confirmMeta(sent, {})).toEqual({ _yoast_wpseo_title: "not_confirmed", _yoast_wpseo_metadesc: "not_confirmed" });
    expect(confirmMeta(sent, [])).toEqual({ _yoast_wpseo_title: "not_confirmed", _yoast_wpseo_metadesc: "not_confirmed" });
    expect(confirmMeta(sent, null)).toEqual({ _yoast_wpseo_title: "not_confirmed", _yoast_wpseo_metadesc: "not_confirmed" });
  });
  it("accepts WordPress's array-wrapped meta values and ignores surrounding whitespace", () => {
    expect(confirmMeta({ a: "x" }, { a: [" x "] })).toEqual({ a: "confirmed" });
  });
});

describe("slugFromUrl / editUrlFor", () => {
  it("takes the last path segment and returns null for the homepage", () => {
    expect(slugFromUrl("https://a.com/blog/my-post/")).toBe("my-post");
    expect(slugFromUrl("https://a.com/")).toBeNull();
    expect(slugFromUrl("not a url")).toBeNull();
    expect(slugFromUrl("https://a.com/%D8%B3%D9%84%D8%A7%D9%85")).toBe("سلام");
  });
  it("builds the wp-admin edit link", () => {
    expect(editUrlFor("https://a.com/", 42)).toBe("https://a.com/wp-admin/post.php?post=42&action=edit");
  });
});

describe("summarizeApplication", () => {
  it("counts what was really applied", () => {
    expect(summarizeApplication("yoast", { a: "confirmed", b: "not_confirmed" })).toEqual({ applied: 1, notConfirmed: 1 });
    expect(summarizeApplication(null, { a: "not_confirmed" })).toEqual({ applied: 0, notConfirmed: 1 });
  });
});
