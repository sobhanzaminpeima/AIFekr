import { describe, it, expect } from "vitest";
import { getCrmTemplate, crmIndustryTemplates, defaultCrmTemplate } from "./industryTemplates";

describe("getCrmTemplate", () => {
  it("returns the matching template for a known industry slug", () => {
    const t = getCrmTemplate("real-estate");
    expect(t.pipelineName).toBe("فروش/اجاره املاک");
    expect(t.stages.length).toBeGreaterThan(0);
  });

  it("falls back to the default template for an unknown slug", () => {
    expect(getCrmTemplate("not-a-real-industry")).toBe(defaultCrmTemplate);
  });

  it("falls back to the default template when slug is null/undefined", () => {
    expect(getCrmTemplate(null)).toBe(defaultCrmTemplate);
    expect(getCrmTemplate(undefined)).toBe(defaultCrmTemplate);
  });

  it("every template has exactly one won stage and at least one lost stage", () => {
    for (const [slug, template] of Object.entries(crmIndustryTemplates)) {
      const wonCount = template.stages.filter((s) => s.isWon).length;
      const lostCount = template.stages.filter((s) => s.isLost).length;
      expect(wonCount, `${slug} should have exactly one won stage`).toBe(1);
      expect(lostCount, `${slug} should have at least one lost stage`).toBeGreaterThanOrEqual(1);
    }
  });
});
