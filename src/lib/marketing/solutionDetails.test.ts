import { describe, expect, it } from "vitest";
import { solutionCatalog } from "./catalog";
import { solutionDetails } from "./solutionDetails";
import { guides } from "./guides";
import robots from "@/app/robots";

describe("public SEO content contracts", () => {
  it("provides unique localized descriptions and working guides for every solution", () => {
    for (const solution of solutionCatalog) {
      const detail = solutionDetails[solution.slug];
      expect(detail).toBeDefined();
      expect(guides.some(guide => guide.slug === detail.guide)).toBe(true);
      expect(detail.steps.length).toBeGreaterThan(0);
    }
    for (let language = 0; language < 4; language++) {
      const descriptions = solutionCatalog.map(solution => solutionDetails[solution.slug].description[language]);
      expect(descriptions.every(Boolean)).toBe(true);
      expect(new Set(descriptions).size).toBe(solutionCatalog.length);
    }
  });
  it("lets crawlers read noindex on public auth forms while protecting workspace crawl paths", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).not.toContain("/login");
    expect(rule.disallow).not.toContain("/register");
    expect(rule.disallow).toContain("/admin");
    expect(rule.disallow).toContain("/student");
    expect(rule.disallow).toContain("/checkout");
  });
});
