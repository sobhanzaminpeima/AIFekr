import { describe, it, expect } from "vitest";
import { formatListingPrice, describeDetails } from "./listingFormat";

describe("formatListingPrice", () => {
  // The regression this guards: every listing price used to be rendered as
  // Toman with fa-IR numerals regardless of the property's own currency, so
  // a Turkish or German agent's listing was published in the wrong currency.
  it("follows the property's currency, not the reader's language", () => {
    expect(formatListingPrice(BigInt(4500000), "TRY", "en")).toBe("4,500,000 TRY");
    expect(formatListingPrice(BigInt(4500000), "TRY", "fa")).toContain("لیر");
    expect(formatListingPrice(BigInt(4500000), "TRY", "fa")).not.toContain("تومان");
    expect(formatListingPrice(BigInt(250000), "EUR", "de")).toBe("250.000 EUR");
  });

  it("uses Persian numerals only for Iranian currencies read in Persian", () => {
    const faIrt = formatListingPrice(BigInt(8500000000), "IRT", "fa");
    expect(faIrt).toMatch(/[۰-۹]/);
    expect(faIrt).toContain("تومان");

    // Same reader, non-Iranian currency -> Latin digits.
    expect(formatListingPrice(BigInt(250000), "EUR", "fa")).not.toMatch(/[۰-۹]/);
    // Iranian currency, non-Persian reader -> Latin digits, English word.
    expect(formatListingPrice(BigInt(8500000000), "IRT", "en")).toBe("8,500,000,000 Toman");
  });

  it("falls back to the raw code for an unknown currency instead of inventing one", () => {
    expect(formatListingPrice(BigInt(100), "CHF", "en")).toBe("100 CHF");
  });

  it("treats a missing currency as the IRT default", () => {
    expect(formatListingPrice(BigInt(100), "", "en")).toBe("100 Toman");
  });
});

describe("describeDetails", () => {
  it("never leaks Persian units into the English or German prompt", () => {
    const p = { areaSqm: 110, bedrooms: 2, bathrooms: 1 };
    expect(describeDetails(p, "en")).toBe("110 sqm, 2 bedrooms, 1 bathrooms");
    expect(describeDetails(p, "de")).toBe("110 m², 2 Schlafzimmer, 1 Badezimmer");
    expect(describeDetails(p, "en")).not.toMatch(/[؀-ۿ]/);
    expect(describeDetails(p, "de")).not.toMatch(/[؀-ۿ]/);
  });

  it("omits absent fields rather than printing zeros", () => {
    expect(describeDetails({ areaSqm: null, bedrooms: 3, bathrooms: null }, "en")).toBe("3 bedrooms");
    expect(describeDetails({ areaSqm: null, bedrooms: null, bathrooms: null }, "fa")).toBe("");
  });
});
