import { describe, it, expect } from "vitest";
import { parseSeoAccountRates } from "./accountPricing";
describe("account-specific SEO pricing", () => {
  it("uses the authenticated account rates without replacing retail markup", () => { expect(parseSeoAccountRates({ dataforseo_labs: { keyword_suggestions: { live: { priority_normal: [{ cost_type: "per_request", cost: 0.012 }, { cost_type: "per_result", cost: 0.00012 }] } } } }).keywords).toEqual({ baseUsd: 0.012, rowUsd: 0.00012 }); });
  it("does not infer prices for absent endpoints", () => { expect(Object.values(parseSeoAccountRates({}))).toEqual(Array(8).fill(null)); });
  it("refuses unfamiliar or duplicate billing units", () => { expect(parseSeoAccountRates({ serp: { live: { advanced: { priority_normal: [{ cost_type: "per_request", cost: 0.002 }, { cost_type: "per_token", cost: 1 }] } } } }).rank).toBeNull(); });
  it("rejects zero-priced, negative or incomplete action prices", () => { expect(parseSeoAccountRates({ backlinks: { summary: { live: { priority_normal: [{ cost_type: "per_result", cost: 0.1 }] } } } }).backlinks).toBeNull(); });
});
