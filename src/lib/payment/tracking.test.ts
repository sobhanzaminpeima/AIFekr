import { describe, expect, it } from "vitest";
import { paymentHistoryQuery, savedGatewayUrl } from "./tracking";

describe("persistent payment tracking", () => {
  it("bounds history pages and keeps filters predictable", () => {
    expect(paymentHistoryQuery(new URLSearchParams("page=0&filter=pending"))).toEqual({ page: 1, filter: "pending", statuses: ["PENDING"] });
    expect(paymentHistoryQuery(new URLSearchParams("page=999999&filter=admin")).page).toBe(10000);
    expect(paymentHistoryQuery(new URLSearchParams("page=NaN&filter=paid"))).toEqual({ page: 1, filter: "paid", statuses: ["SUCCESS", "PAID"] });
  });
  it("only resumes saved official Zarinpal sessions", () => {
    expect(savedGatewayUrl("zarinpal", JSON.stringify({ paymentUrl: "https://www.zarinpal.com/pg/StartPay/A00001" }))).toBe("https://www.zarinpal.com/pg/StartPay/A00001");
    expect(savedGatewayUrl("zarinpal", JSON.stringify({ paymentUrl: "https://sandbox.zarinpal.com/pg/StartPay/TEST-123" }))).toContain("sandbox.zarinpal.com");
    expect(savedGatewayUrl("bank_transfer", JSON.stringify({ paymentUrl: "https://www.zarinpal.com/pg/StartPay/A00001" }))).toBeNull();
  });
  it.each(["javascript:alert(1)", "http://www.zarinpal.com/pg/StartPay/A", "https://www.zarinpal.com.attacker.test/pg/StartPay/A", "https://evil.test/pg/StartPay/A", "https://user:pass@www.zarinpal.com/pg/StartPay/A", "https://www.zarinpal.com/pg/StartPay/A?redirect=evil", "https://www.zarinpal.com/other/A"])("rejects unsafe saved checkout URL %s", url => {
    expect(savedGatewayUrl("zarinpal", JSON.stringify({ paymentUrl: url }))).toBeNull();
  });
});
