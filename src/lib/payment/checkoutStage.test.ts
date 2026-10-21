import { describe, expect, it } from "vitest";
import { checkoutStage } from "./checkoutStage";

describe("checkout guidance", () => {
  it("never treats transfer acknowledgement or an uploaded receipt as approval", () => {
    expect(checkoutStage({ status: "PENDING", receiptAt: null }, true)).toBe("receipt");
    expect(checkoutStage({ status: "PENDING", receiptAt: "2026-10-05" }, true)).toBe("review");
  });
  it("always derives terminal states from the server", () => {
    expect(checkoutStage({ status: "SUCCESS", receiptAt: null })).toBe("approved");
    for (const status of ["REJECTED", "FAILED", "CANCELLED"]) {
      expect(checkoutStage({ status, receiptAt: "2026-10-05" }, true)).toBe("closed");
    }
  });
  it("resumes at receipt review after reloading", () => {
    expect(checkoutStage({ status: "PENDING", receiptAt: "2026-10-05" })).toBe("review");
    expect(checkoutStage({ status: "PENDING", receiptAt: null })).toBe("transfer");
  });
});
