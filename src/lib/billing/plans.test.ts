import { describe, expect, it } from "vitest";
import { priceForPeriod, packageSchema } from "./plans";

const pkg = (planCode: string, duration: number, termPrices: string) => ({ planCode, duration, termPrices, price: 0, baseCurrency: "TRY" });

describe("priceForPeriod term", () => {
  it("accepts a distinct gaming service without automatic video credits", () => {
    const data = { planCode: "GAMING_SHORTS_3", name: "Gaming", nameEn: "Gaming", category: "VIDEO_FACTORY", credits: 0,
      baseCurrency: "IRT", termPrices: { monthly: 690000 }, entitlements: { limits: { gamingShorts: 3, inputMaxSeconds: 1800 } } };
    expect(packageSchema.safeParse(data).success).toBe(true);
    expect(packageSchema.safeParse({ ...data, planCode: "VF_AUTO_10" }).success).toBe(false);
  });
  it("gives the three-month Student package its three months, though its price sits under the monthly key", () => {
    expect(priceForPeriod(pkg("STUDENT_QUARTERLY", 90, '{"monthly":279999}'), "monthly")).toMatchObject({ minor: 279999, months: 3, days: 90 });
  });
  it("leaves the monthly and quarterly Student offers unchanged", () => {
    expect(priceForPeriod(pkg("STUDENT_MONTHLY", 30, '{"monthly":1990}'), "monthly")).toMatchObject({ months: 1, days: 30 });
    expect(priceForPeriod(pkg("STUDENT_FIRST_THREE_MONTHS", 90, '{"quarterly":5490}'), "quarterly")).toMatchObject({ months: 3, days: 90 });
  });
  it("does not stretch a monthly term on other packages", () => {
    expect(priceForPeriod(pkg("CHAT_ECO_30", 90, '{"monthly":1000}'), "monthly")).toMatchObject({ months: 1, days: 30 });
  });
});
