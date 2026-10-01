import { describe, expect, it } from "vitest";
import { shouldShowTrialBanner } from "./trialBanner";

const NOW = new Date("2026-10-01T12:00:00.000Z").getTime();

describe("trial banner visibility", () => {
  it("keeps the countdown visible while a trial is still active", () => {
    expect(shouldShowTrialBanner({ trialEndsAt: "2026-10-02T12:00:00.000Z", plan: "PRO", planExpiry: "2026-10-02T12:00:00.000Z" }, NOW)).toBe(true);
  });

  it("hides an expired trial warning when a paid plan is still active", () => {
    expect(shouldShowTrialBanner({ trialEndsAt: "2026-09-27T17:01:47.000Z", plan: "ALPHA", planExpiry: "2028-07-20T20:00:00.000Z" }, NOW)).toBe(false);
  });

  it("keeps the warning for a free user whose trial expired", () => {
    expect(shouldShowTrialBanner({ trialEndsAt: "2026-09-27T17:01:47.000Z", plan: "FREE", planExpiry: null }, NOW)).toBe(true);
  });

  it("keeps the warning when both the trial and paid plan have expired", () => {
    expect(shouldShowTrialBanner({ trialEndsAt: "2026-09-27T17:01:47.000Z", plan: "PRO", planExpiry: "2026-09-28T00:00:00.000Z" }, NOW)).toBe(true);
  });

  it("hides an old trial warning for an indefinite paid plan", () => {
    expect(shouldShowTrialBanner({ trialEndsAt: "2026-09-27T17:01:47.000Z", plan: "ALPHA", planExpiry: null }, NOW)).toBe(false);
  });
});
