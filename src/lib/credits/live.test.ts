import { describe, it, expect } from "vitest";
import { shouldRefreshAfter } from "./live";

describe("shouldRefreshAfter", () => {
  it("refreshes after mutating calls to the API", () => {
    expect(shouldRefreshAfter("/api/seo/audits/abc/improve", "POST")).toBe(true);
    expect(shouldRefreshAfter("/api/chat", "post")).toBe(true);
    expect(shouldRefreshAfter("https://aifekr.com/api/image/generate", "POST")).toBe(true);
  });
  it("does not refresh after plain reads", () => {
    expect(shouldRefreshAfter("/api/seo/sites", "GET")).toBe(false);
    expect(shouldRefreshAfter("/api/video/status?id=1", "GET")).toBe(false);
  });
  it("refreshes after the GET endpoints that do spend credits", () => {
    expect(shouldRefreshAfter("/api/crm/agency-report?periodDays=30", "GET")).toBe(true);
    expect(shouldRefreshAfter("/api/crm/properties/p1/pricing-advice", "GET")).toBe(true);
    expect(shouldRefreshAfter("/api/crm/lead-matcher", "GET")).toBe(true);
    expect(shouldRefreshAfter("/api/sales/followups", "GET")).toBe(true);
  });
  it("ignores the balance endpoints themselves (no refresh loop) and non-API urls", () => {
    expect(shouldRefreshAfter("/api/user/profile", "POST")).toBe(false);
    expect(shouldRefreshAfter("/api/credits/costs", "POST")).toBe(false);
    expect(shouldRefreshAfter("/_next/static/x.js", "POST")).toBe(false);
  });
});
