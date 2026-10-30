import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SHELL_COPY_SOURCE, shellCopy } from "./shellCopy";

const CLASSIC = [
  "components/layout/Sidebar.tsx", "components/layout/MobileNavShell.tsx", "components/layout/TrialBanner.tsx",
  "components/layout/SubscriptionGate.tsx", "components/billing/PendingPaymentNotice.tsx", "components/layout/SessionWatchdog.tsx",
  "components/layout/WorkspaceHeader.tsx", "components/layout/WorkspaceGuide.tsx", "components/ui/CommandPalette.tsx",
  "components/organization/OrganizationSwitcher.tsx", "components/student/StudentTimerDock.tsx", "components/layout/DashboardPullToRefresh.tsx",
].map((file) => readFileSync(join(__dirname, "../..", file), "utf8")).join("\n");

describe("new-design frame wording", () => {
  it("is word for word the classic frame's", () => {
    const { COPY, TOOLS, ASSISTANTS, PLAN_NAMES } = SHELL_COPY_SOURCE;
    const strings = [...Object.values(COPY), ...TOOLS.map(([, v]) => v), ...ASSISTANTS.map(([, v]) => v), ...Object.values(PLAN_NAMES)].flat();
    const missing = strings.flatMap((s) => s.replace(/\\"/g, "\"").split(/\{n\}|\{name\}/)).filter((part) => part.trim() && !CLASSIC.includes(part));
    expect(missing).toEqual([]);
  });
  it("keeps tool and assistant links identical to the classic sidebar", () => {
    for (const [href] of [...SHELL_COPY_SOURCE.TOOLS, ...SHELL_COPY_SOURCE.ASSISTANTS]) expect(CLASSIC).toContain(`href: "${href}"`);
  });
  it("picks the requested language", () => {
    expect(shellCopy("de").newChat).toBe("Neuer Chat");
    expect(shellCopy("fa").fit).toBe("فیتنس آی‌فکر");
    expect(shellCopy("tr").fit).toBe("AIFekr FIT");
    expect(shellCopy("en").nav.chat).toBeTruthy();
  });
});
