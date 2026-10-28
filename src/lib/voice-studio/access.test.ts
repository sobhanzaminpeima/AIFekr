import { describe, expect, it } from "vitest";
import { planAllowed } from "./service";

const policy = { allowedPlans: ["PRO", "BUSINESS"] };
const future = new Date(Date.now() + 86400000), past = new Date(Date.now() - 86400000);

describe("voice studio plan access", () => {
  it("allows admins whatever their plan", () => {
    expect(planAllowed({ role: "ADMIN", plan: "FREE", planExpiry: null }, policy)).toBe(true);
    expect(planAllowed({ role: "SUPER_ADMIN", plan: "FREE", planExpiry: null }, policy)).toBe(true);
  });
  it("allows an active allowed plan", () => {
    expect(planAllowed({ role: "USER", plan: "PRO", planExpiry: future }, policy)).toBe(true);
  });
  it("refuses plans outside the list and expired plans", () => {
    expect(planAllowed({ role: "USER", plan: "FREE", planExpiry: null }, policy)).toBe(false);
    expect(planAllowed({ role: "USER", plan: "STUDENT_QUARTERLY", planExpiry: future }, policy)).toBe(false);
    expect(planAllowed({ role: "USER", plan: "PRO", planExpiry: past }, policy)).toBe(false);
  });
});
