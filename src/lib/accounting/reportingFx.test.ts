import { describe, it, expect } from "vitest";
import {
  convert, formatReportAmount, rateDisclosure, conversionUnavailable,
  REPORT_CURRENCIES, type FxSnapshot,
} from "./reportingFx";

// A fixed snapshot with the shape and the real order of magnitude the provider
// returns, so the assertions below are about behaviour rather than live rates.
const SNAP: FxSnapshot = {
  rates: { USD: 1, EUR: 0.861064, GBP: 0.739657, TRY: 48.42404, IRR: 1525372.32493, IRT: 152537.232493 },
  asOf: new Date("2026-09-06T00:02:31Z"),
  provider: "https://www.exchangerate-api.com",
};

describe("convert", () => {
  it("returns the amount untouched when the currencies match", () => {
    expect(convert(1000, "IRT", "IRT", SNAP)).toEqual({ value: 1000, rate: 1 });
  });

  it("converts Toman to Lira through USD", () => {
    // 152,537.23 Toman = 1 USD = 48.42 TRY, so 1,525,372 Toman ≈ 484 TRY.
    const r = convert(1_525_372, "IRT", "TRY", SNAP);
    expect(r).not.toBeNull();
    expect(Math.round(r!.value)).toBe(484);
  });

  it("is symmetric — converting back returns the original", () => {
    const there = convert(5000, "EUR", "IRT", SNAP)!;
    const back = convert(there.value, "IRT", "EUR", SNAP)!;
    expect(Math.round(back.value)).toBe(5000);
  });

  it("treats Toman as exactly ten Rial", () => {
    const rial = convert(100, "USD", "IRR", SNAP)!;
    const toman = convert(100, "USD", "IRT", SNAP)!;
    expect(rial.value / toman.value).toBeCloseTo(10, 6);
  });

  it("refuses rather than guesses when a currency is missing from the snapshot", () => {
    expect(convert(100, "USD", "CHF", SNAP)).toBeNull();
    expect(convert(100, "XYZ", "USD", SNAP)).toBeNull();
  });
});

describe("formatReportAmount", () => {
  it("uses Persian numerals only for an Iranian currency read in Persian", () => {
    expect(formatReportAmount(1_525_372, "IRT", "fa")).toMatch(/[۰-۹]/);
    expect(formatReportAmount(1_525_372, "IRT", "fa")).toContain("تومان");
    // Same reader, foreign currency -> Latin digits.
    expect(formatReportAmount(484, "TRY", "fa")).not.toMatch(/[۰-۹]/);
    // Iranian currency, non-Persian reader -> Latin digits.
    expect(formatReportAmount(1_525_372, "IRT", "en")).toBe("1,525,372 Toman");
  });

  it("groups digits the German way for a German reader", () => {
    expect(formatReportAmount(1_525_372, "EUR", "de")).toBe("1.525.372 EUR");
  });

  it("falls back to the raw code rather than inventing a name", () => {
    expect(formatReportAmount(10, "CHF", "en")).toBe("10 CHF");
  });
});

describe("rateDisclosure", () => {
  // The whole point of the feature: a converted figure without its rate and
  // date is an unsourced claim that would be a different number next week.
  it("states the rate, the rate's own date, and the provider", () => {
    const r = convert(1, "IRT", "TRY", SNAP)!;
    for (const lang of ["fa", "en", "de"] as const) {
      const text = rateDisclosure("IRT", "TRY", r.rate, SNAP, lang);
      expect(text).toContain("2026-09-06");
      expect(text).toContain("exchangerate-api.com");
      expect(text.length).toBeGreaterThan(40);
    }
  });

  it("uses the date the rate is FROM, not the time the report ran", () => {
    const text = rateDisclosure("IRT", "EUR", 0.0000056, SNAP, "en");
    expect(text).toContain("2026-09-06");
    expect(text).not.toContain(new Date().toISOString().slice(11, 16));
  });

  it("says the recorded amount is the authoritative one", () => {
    expect(rateDisclosure("IRT", "USD", 1, SNAP, "en")).toMatch(/authoritative/i);
    expect(rateDisclosure("IRT", "USD", 1, SNAP, "fa")).toContain("مرجع");
    expect(rateDisclosure("IRT", "USD", 1, SNAP, "de")).toContain("Maßgeblich");
  });
});

describe("conversionUnavailable", () => {
  it("explains the absence in every language instead of showing a guess", () => {
    for (const lang of ["fa", "en", "de"] as const) {
      expect(conversionUnavailable(lang).length).toBeGreaterThan(30);
    }
    expect(conversionUnavailable("en")).toMatch(/not been converted/i);
  });
});

describe("REPORT_CURRENCIES", () => {
  it("covers every currency a property can be priced in", () => {
    // Mirrors CURRENCY_OPTIONS in the CRM property form.
    for (const c of ["IRT", "IRR", "USD", "GBP", "EUR", "TRY"]) {
      expect(REPORT_CURRENCIES as readonly string[]).toContain(c);
    }
  });
});
