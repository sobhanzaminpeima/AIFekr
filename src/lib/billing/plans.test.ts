import { describe, expect, it } from "vitest";
import { priceForPeriod } from "./plans";

const pkg = (planCode: string, duration: number, termPrices: string) => ({ planCode, duration, termPrices, price: 0, baseCurrency: "TRY" });

describe("priceForPeriod term", () => {
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
