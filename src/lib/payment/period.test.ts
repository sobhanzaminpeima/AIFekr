import { describe, it, expect } from "vitest";
import { resolvePeriod, PERIOD_MONTHS, PERIOD_DISCOUNT } from "./period";

describe("resolvePeriod", () => {
  it("maps each of the 4 billing terms to the right month count and discount", () => {
    expect(resolvePeriod("monthly")).toEqual({ months: 1, discount: 0 });
    expect(resolvePeriod("quarterly")).toEqual({ months: 3, discount: 0.05 });
    expect(resolvePeriod("semiannual")).toEqual({ months: 6, discount: 0.1 });
    expect(resolvePeriod("annual")).toEqual({ months: 12, discount: 2 / 12 });
  });

  it("defaults an unknown or missing period to monthly, no discount", () => {
    expect(resolvePeriod("bogus")).toEqual({ months: 1, discount: 0 });
    expect(resolvePeriod("")).toEqual({ months: 1, discount: 0 });
  });

  it("charges a longer commitment strictly less per month than a shorter one", () => {
    const baseToman = 1_000_000;
    const priceFor = (period: string) => {
      const { months, discount } = resolvePeriod(period);
      return Math.round(baseToman * months * (1 - discount));
    };
    const perMonth = (period: string) => priceFor(period) / resolvePeriod(period).months;

    expect(perMonth("quarterly")).toBeLessThan(perMonth("monthly"));
    expect(perMonth("semiannual")).toBeLessThan(perMonth("quarterly"));
    expect(perMonth("annual")).toBeLessThan(perMonth("semiannual"));
  });

  it("keeps PERIOD_MONTHS and PERIOD_DISCOUNT covering the same 4 keys", () => {
    expect(Object.keys(PERIOD_MONTHS).sort()).toEqual(Object.keys(PERIOD_DISCOUNT).sort());
  });
});
