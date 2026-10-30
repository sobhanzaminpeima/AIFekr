import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIDEBAR_DEPARTMENTS, sidebarModel } from "./sidebarModel";
import { sidebarAccess } from "./sidebarAccess";
import fa from "@/lib/i18n/fa";

const sidebar = readFileSync(join(__dirname, "../../components/layout/Sidebar.tsx"), "utf8");

describe("new-design sidebar model", () => {
  it("lists the classic departments' destinations in the same order", () => {
    const classic = [...sidebar.matchAll(/label: t\.nav\.(\w+), href: "([^"]+)"/g)].map((m) => `${m[2]}:${m[1]}`);
    const model = SIDEBAR_DEPARTMENTS.flatMap((d) => d.items.map(([href, key]) => `${href}:${key}`));
    expect(classic).toEqual(model);
  });
  it("localizes labels and finds the page guide", () => {
    const m = sidebarModel("fa", fa.nav, "/home");
    expect(m.departments[0].items[0]).toMatchObject({ href: "/crm", label: fa.nav.crm });
    expect(m.guide?.links.map((l) => l.href)).toEqual(["/agents", "/chat"]);
    expect(m.pageLabel).toBe("خانه");
  });
  it("hides business for students without a CRM and for FIT accounts", () => {
    expect(sidebarAccess({ accountType: "STUDENT", industryPackId: "u" }).hideBusiness).toBe(true);
    expect(sidebarAccess({ accountType: "STUDENT", crmPlan: "CRM_PRO", crmPlanExpiry: null }).hideBusiness).toBe(false);
    expect(sidebarAccess({ accountType: "FITNESS" })).toMatchObject({ fitnessOnly: true, hideBusiness: true });
    expect(sidebarAccess({ crmPlan: "CRM_PRO", crmPlanExpiry: new Date(Date.now() - 1000) }).hasBusinessAccess).toBe(false);
  });
});
