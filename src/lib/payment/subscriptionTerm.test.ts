import { describe, expect, it } from "vitest";
import { subscriptionTerm } from "./subscriptionTerm";
import { periodPrice } from "@/lib/marketing/pricing";

describe("subscription terms", () => {
  it.each(["TEAM_STARTER", "CRM_SOLO"])("aligns advertised price and activation duration for %s", plan => {
    for (const period of ["monthly", "quarterly", "semiannual"] as const) {
      const term = subscriptionTerm(plan, period, 30);
      expect(term.days).toBe(30 * term.months);
      expect(periodPrice(80, period, "en")).toBe(Math.round(80 * term.priceMultiplier * (1 - term.discount) * 100) / 100);
    }
  });
  it("preserves the fixed student welcome offer", () => {
    expect(subscriptionTerm("STUDENT_FIRST_TWO_MONTHS", "monthly", 60)).toEqual({ months: 2, discount: 0, priceMultiplier: 1, days: 60 });
  });
  it("does not multiply one-time credit purchases", () => {
    expect(subscriptionTerm("CREDITS_test", "semiannual", 30)).toEqual({ months: 1, discount: 0, priceMultiplier: 1, days: 30 });
  });
  it("charges the three-month offer once and grants 90 days", () => {
    expect(subscriptionTerm("STUDENT_FIRST_THREE_MONTHS", "monthly", 90)).toEqual({months:3,discount:0,priceMultiplier:1,days:90});
  });
});
