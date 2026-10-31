import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PAYMENTS_STRINGS, paymentsCopy } from "./paymentsCopy";
import { extractKeyedStrings } from "@/lib/crm/crmCopy.extract";

it("is word for word the classic payment history's wording", () => {
  const src = readFileSync(join(__dirname, "../../components/billing/PaymentsView.tsx"), "utf8");
  expect(PAYMENTS_STRINGS).toEqual(extractKeyedStrings([src], /\bt\(/g));
});
it("localizes the page", () => {
  expect(paymentsCopy("fa")["Continue on Zarinpal"]).toBe("ادامهٔ پرداخت در زرین‌پال");
  expect(paymentsCopy("en")["Payments & activation"]).toBe("Payments & activation");
});
