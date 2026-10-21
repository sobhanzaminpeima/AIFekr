import { describe, expect, it } from "vitest";
import { packageAmount, packageCurrency, formatPackageAmount } from "./packageCurrency";

describe("package currency by language", () => {
  const rates = { usdToToman: 100000, usdToTry: 50 };
  it.each([ ["fa", "IRT", 8000000], ["tr", "TRY", 4000], ["en", "USD", 80], ["de", "USD", 80] ] as const)("uses the expected currency for %s", (lang, currency, amount) => {
    expect(packageCurrency(lang)).toBe(currency);
    expect(packageAmount(80, lang, rates)).toBe(amount);
    expect(packageAmount(240, lang, rates)).toBe(amount * 3);
  });
  it("formats Persian prices as whole Toman amounts", () => {
    expect(formatPackageAmount(8000000.4, "fa")).toBe("۸٬۰۰۰٬۰۰۰ تومان");
  });
});
