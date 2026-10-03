import { describe, expect, it } from "vitest";
import { copy, features, solutionCatalog, text } from "./catalog";
import { periodPrice } from "./pricing";
import { PERIOD_DISCOUNT, PERIOD_MONTHS, type BillingPeriod } from "@/lib/payment/period";

describe("public marketing contract", () => {
  it("has complete four-language authored copy", () => {
    const values = [...Object.values(copy), ...features.flatMap(f => [f.title, f.desc, f.requirement, ...f.items]), ...solutionCatalog.map(s => s.title)];
    for (const value of values) { expect(value).toHaveLength(4); for (const part of value) expect(part.trim()).not.toBe(""); }
    expect(text("tr", copy.product)).toBe("Ürün");
  });
  it("has unique product paths and only references implemented feature slugs", () => {
    expect(new Set(features.map(f => f.slug)).size).toBe(features.length);
    for (const solution of solutionCatalog) for (const slug of solution.modules) expect(features.some(f => f.slug === slug)).toBe(true);
    for (const f of features) expect(f.route).toMatch(/^\//);
  });
  it.each(["monthly", "quarterly", "semiannual", "annual"] as BillingPeriod[])("matches checkout rounding for %s", p => {
    const expected = 123456 * PERIOD_MONTHS[p] * (1 - PERIOD_DISCOUNT[p]);
    expect(periodPrice(123456, p, "fa")).toBe(Math.round(expected));
    expect(periodPrice(19.99, p, "en")).toBe(Math.round(19.99 * PERIOD_MONTHS[p] * (1 - PERIOD_DISCOUNT[p]) * 100) / 100);
    expect(periodPrice(0, p, "en")).toBe(0);
  });
});
