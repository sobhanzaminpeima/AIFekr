import { describe, it, expect } from "vitest";
import { isPlanActive, effectivePlan, hasPlan, MODULE_PLANS } from "./planGuard";

type MockUser = {
  plan: string;
  planExpiry: Date | null;
  trialEndsAt?: Date | null;
};

const future = new Date(Date.now() + 86400_000);
const past = new Date(Date.now() - 86400_000);

describe("isPlanActive", () => {
  it("returns true for active paid plan", () => {
    expect(isPlanActive({ plan: "PRO", planExpiry: future } as MockUser)).toBe(true);
  });

  it("returns false for expired plan", () => {
    expect(isPlanActive({ plan: "PRO", planExpiry: past } as MockUser)).toBe(false);
  });

  it("returns true for FREE plan with no expiry", () => {
    expect(isPlanActive({ plan: "FREE", planExpiry: null } as MockUser)).toBe(true);
  });
});

describe("effectivePlan", () => {
  it("returns plan for active subscription", () => {
    expect(effectivePlan({ plan: "BUSINESS", planExpiry: future } as MockUser)).toBe("BUSINESS");
  });

  it("returns FREE for expired plan", () => {
    expect(effectivePlan({ plan: "PRO", planExpiry: past } as MockUser)).toBe("FREE");
  });
});

describe("hasPlan", () => {
  it("allows access to FREE modules for any user", () => {
    expect(hasPlan({ plan: "FREE", planExpiry: null } as MockUser, "FREE")).toBe(true);
  });

  it("allows PRO user to access PRO module", () => {
    expect(hasPlan({ plan: "PRO", planExpiry: future } as MockUser, "PRO")).toBe(true);
  });

  it("denies FREE user access to PRO module", () => {
    expect(hasPlan({ plan: "FREE", planExpiry: null } as MockUser, "PRO")).toBe(false);
  });

  it("denies expired PRO user access to PRO module", () => {
    expect(hasPlan({ plan: "PRO", planExpiry: past } as MockUser, "PRO")).toBe(false);
  });
});

describe("MODULE_PLANS", () => {
  it("chat and image are FREE", () => {
    expect(MODULE_PLANS.chat).toBe("FREE");
    expect(MODULE_PLANS.image).toBe("FREE");
  });

  it("video and music require PRO", () => {
    expect(MODULE_PLANS.video).toBe("PRO");
    expect(MODULE_PLANS.music).toBe("PRO");
  });

  it("games are FREE", () => {
    expect(MODULE_PLANS.games).toBe("FREE");
  });
});
