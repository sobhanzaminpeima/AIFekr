import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { homeView } from "./homeView";

const classic = readFileSync(join(__dirname, "../../app/(dashboard)/home/page.tsx"), "utf8") + readFileSync(join(__dirname, "../../components/layout/WorkspaceHome.tsx"), "utf8");
const source = readFileSync(join(__dirname, "homeView.ts"), "utf8");

const payload = {
  stats: { activeDeals: 3, pipelineValue: 2_500_000_000, newLeadsThisWeek: 0, overdueInvoiceCount: 1, overdueInvoiceTotal: 0, monthRevenue: 1500, upcomingViewings: 0 },
  attention: [{ id: "a", severity: "critical", title: "t", detail: "d", href: "/crm" }],
  teamActivity: [{ id: "x", agent: "sales", title: "t", detail: "d", href: "/sales", at: "" }],
  meaningfulStats: ["activeDeals", "pipelineValue", "overdueInvoiceCount"],
  isEmptyWorkspace: false,
  industryPack: { name: "املاک", nameEn: "Real estate", emoji: "🏠", slug: "real-estate" },
  fitnessWorkspace: { enabled: false },
  agentAccess: { student: false, voice: false, business: true },
  studentWorkspace: { enabled: false, courseCount: 0, upcomingExamCount: 0, pendingTaskCount: 0 },
  businessAccess: true,
} as unknown as Parameters<typeof homeView>[0];

describe("new-design home view", () => {
  it("uses only the classic home page's wording", () => {
    const literals = [...source.matchAll(/(?:tri\(lang|t2\()([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
    expect(literals.length).toBeGreaterThan(60);
    expect(literals.filter((s) => !classic.includes(s))).toEqual([]);
  });
  it("formats figures like the classic page", () => {
    const v = homeView(payload, "en");
    expect(v.stats.map((s) => [s.key, s.value])).toEqual([["activeDeals", "3"], ["pipelineValue", "2.5 B"], ["overdueInvoiceCount", "1"]]);
    expect(v.stats[1].exact).toBe("2,500,000,000");
    expect(v.attention[0].severityLabel).toBe("Urgent");
    expect(v.team[0]).toMatchObject({ name: "The sales lead", initial: "S" });
    expect(v.coreJobs.map((j) => j.href)).toEqual(["/crm?tab=properties", "/crm?tab=viewings", "/accounting/owner-statements"]);
    expect(v.copy.attentionTitle).toBe("1 things need you");
  });
});
