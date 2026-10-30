import { describe, expect, it } from "vitest";
import { sidebarModel } from "./sidebarModel";
import { sidebarAccess } from "./sidebarAccess";

describe("new-design frame data", () => {
  it("lists every destination with its localized label", () => {
    const m = sidebarModel("de");
    expect(m.destinations[0]).toEqual({ href: "/home", label: "Startseite" });
    expect(m.destinations.some((d) => d.href === "/chat")).toBe(true);
  });
  it("hides business for students without a CRM and for FIT accounts", () => {
    expect(sidebarAccess({ accountType: "STUDENT", industryPackId: "u" }).hideBusiness).toBe(true);
    expect(sidebarAccess({ accountType: "STUDENT", crmPlan: "CRM_PRO", crmPlanExpiry: null }).hideBusiness).toBe(false);
    expect(sidebarAccess({ accountType: "FITNESS" })).toMatchObject({ fitnessOnly: true, hideBusiness: true });
    expect(sidebarAccess({ crmPlan: "CRM_PRO", crmPlanExpiry: new Date(Date.now() - 1000) }).hasBusinessAccess).toBe(false);
  });
});
