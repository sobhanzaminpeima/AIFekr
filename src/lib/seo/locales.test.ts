import { describe, expect, it } from "vitest";
import { isPublicRoute, localizedPublicPath, stripPublicLocale } from "./locales";
import { pageMetadata, publicAlternates, PRIVATE_PREFIXES } from "./site";
describe("public locale URLs", () => {
  it("keeps queries and anchors while localizing public links", () => {
    expect(localizedPublicPath("/pricing?source=home#compare", "de")).toBe("/de/pricing?source=home#compare");
    expect(localizedPublicPath("/en/features/crm", "fa")).toBe("/features/crm");
    expect(localizedPublicPath("/", "en")).toBe("/en");
  });
  it("never rewrites account, private or external destinations", () => {
    for (const path of ["/api/user/profile", "/plans?period=quarterly", "/admin/users", "/crm", "https://example.com", "#pricing"]) expect(localizedPublicPath(path, "en")).toBe(path);
    expect(isPublicRoute("/features/crm/private")).toBe(false);
  });
  it("emits self-canonical and reciprocal hreflang URLs", () => {
    const alternates = publicAlternates("en", "/features/crm");
    expect(alternates.canonical).toBe(alternates.languages.en);
    expect(publicAlternates("fa", "/features/crm").languages).toEqual(alternates.languages);
    expect(alternates.languages["x-default"]).toBe(alternates.languages.fa);
    const meta = pageMetadata("de", "/pricing", { fa: "الف", en: "A", de: "B" }, { fa: "ج", en: "C", de: "D" });
    expect(meta.alternates?.canonical).toBe(publicAlternates("de", "/pricing").languages.de);
  });
  it("recognizes locale roots without treating private paths as public", () => {
    expect(stripPublicLocale("/en")).toEqual({ lang: "en", path: "/" });
    expect(stripPublicLocale("/de/pricing")).toEqual({ lang: "de", path: "/pricing" });
    expect(isPublicRoute(stripPublicLocale("/en/admin").path)).toBe(false);
    expect(PRIVATE_PREFIXES).toContain("/checkout");
    expect(PRIVATE_PREFIXES).toContain("/student");
  });
  it("links Turkish visitors directly to the available English industry detail", () => {
    expect(localizedPublicPath("/industry/restaurant?source=index#agents", "tr")).toBe("/en/industry/restaurant?source=index#agents");
    expect(localizedPublicPath("/industry", "tr")).toBe("/tr/industry");
    const alternates = publicAlternates("tr", "/industry/restaurant");
    expect(alternates.canonical).toBe(alternates.languages.en);
    expect(alternates.languages).not.toHaveProperty("tr");
  });
});
