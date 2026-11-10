import { describe, expect, it } from "vitest";
import { mainPlanConflict } from "./planConflict";

const later = new Date(Date.now() + 86400000);
const earlier = new Date(Date.now() - 86400000);

describe("mainPlanConflict", () => {
  it("stops Student over an active paid plan, and a paid plan over an active Student package", () => {
    expect(mainPlanConflict({ plan: "PRO", planExpiry: later }, "STUDENT_MONTHLY")).toBe(true);
    expect(mainPlanConflict({ plan: "TEAM", planExpiry: null }, "STUDENT_MONTHLY")).toBe(true);
    expect(mainPlanConflict({ plan: "STUDENT_MONTHLY", planExpiry: later }, "PRO")).toBe(true);
  });
  it("allows renewals and moves within the same kind of plan", () => {
    expect(mainPlanConflict({ plan: "STUDENT_MONTHLY", planExpiry: later }, "STUDENT_QUARTERLY")).toBe(false);
    expect(mainPlanConflict({ plan: "PRO", planExpiry: later }, "TEAM_BUSINESS_START")).toBe(false);
  });
  it("allows free accounts, trials and expired plans", () => {
    expect(mainPlanConflict({ plan: "FREE", planExpiry: null }, "STUDENT_MONTHLY")).toBe(false);
    expect(mainPlanConflict({ plan: "PRO", planExpiry: later, trialLimited: true }, "STUDENT_MONTHLY")).toBe(false);
    expect(mainPlanConflict({ plan: "PRO", planExpiry: earlier }, "STUDENT_MONTHLY")).toBe(false);
  });
  it("ignores purchases with their own expiry", () => {
    const student = { plan: "STUDENT_MONTHLY", planExpiry: later };
    for (const code of ["CREDITS_x", "CRM_SOLO", "VOICE_MONTHLY", "FIT_MARKETPLACE"]) expect(mainPlanConflict(student, code)).toBe(false);
    for (const category of ["CHAT_STARTER", "VIDEO_FACTORY", "FITNESS"]) expect(mainPlanConflict(student, "ANY_PACKAGE", category)).toBe(false);
  });
});
