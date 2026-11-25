import { describe, expect, it } from "vitest";
import { creditsFor, creditsPerIntervalFor } from "./domain";

describe("per-model voice pricing", () => {
  const policy = { creditsPerInterval: 50, billingInterval: 30 as const, modelCreditsPerInterval: { eleven_flash_v2_5: 25 } };
  it("uses the model's own price when one is set", () => {
    expect(creditsPerIntervalFor(policy, "eleven_flash_v2_5")).toBe(25);
    expect(creditsFor(61, policy, "eleven_flash_v2_5")).toBe(75);
  });
  it("falls back to the default price", () => {
    expect(creditsFor(61, policy, "eleven_v4")).toBe(150);
    expect(creditsFor(30, { creditsPerInterval: 50, billingInterval: 30 })).toBe(50);
  });
});
