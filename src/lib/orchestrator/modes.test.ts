import { describe, it, expect } from "vitest";
import { gateToolCall, isDeniedTool, modeAllowsTier, ACTION_TTL_MS } from "./modes";
import { allTools, getTool } from "./tools";
import { __DRAFT_MODE_FOR_TESTS } from "./tools/social";

/**
 * The security tests for the mode boundary. These are the tests that matter
 * most in this whole feature: every one of them corresponds to a locked
 * decision in the master prompt, and each would be a real vulnerability if it
 * silently stopped holding.
 */

describe("support_mode has no access to tenant data, structurally", () => {
  it("grants only the KB tier", () => {
    expect(modeAllowsTier("support_mode", "KB")).toBe(true);
    expect(modeAllowsTier("support_mode", "READ")).toBe(false);
    expect(modeAllowsTier("support_mode", "DRAFT")).toBe(false);
    expect(modeAllowsTier("support_mode", "COMMIT")).toBe(false);
  });

  it("rejects every real tool in the table when asked for in support_mode", () => {
    // Not one tool in the table is KB-tier, so support_mode can reach none of
    // them. If someone later adds a KB-tier data tool, this test is where the
    // mistake surfaces.
    for (const tool of allTools()) {
      const decision = gateToolCall({ mode: "support_mode", toolKey: tool.key, tier: tool.tier, planSatisfied: true });
      expect(decision.allowed, `${tool.key} must not be reachable in support_mode`).toBe(false);
    }
  });
});

describe("the never-build deny list", () => {
  it("blocks Instagram publishing under any naming a model might propose", () => {
    expect(isDeniedTool("social.publishPost")).toBe(true);
    expect(isDeniedTool("instagram.publish")).toBe(true);
    expect(isDeniedTool("social.publishNow")).toBe(true);
  });

  it("blocks deletions, money, team/role changes, credentials and admin", () => {
    expect(isDeniedTool("crm.deleteContact")).toBe(true);
    expect(isDeniedTool("accounting.payInvoice")).toBe(true);
    expect(isDeniedTool("billing.changePlan")).toBe(true);
    expect(isDeniedTool("credits.grant")).toBe(true);
    expect(isDeniedTool("team.inviteMember")).toBe(true);
    expect(isDeniedTool("crm.changeRole")).toBe(true);
    expect(isDeniedTool("settings.security")).toBe(true);
    expect(isDeniedTool("user.resetPassword")).toBe(true);
    expect(isDeniedTool("admin.users")).toBe(true);
    expect(isDeniedTool("social.disconnectAccount")).toBe(true);
  });

  it("is checked before the tier, so a denied key is refused even with every tier granted", () => {
    const decision = gateToolCall({ mode: "full_mode", toolKey: "social.publish", tier: "READ", planSatisfied: true });
    expect(decision).toEqual({ allowed: false, reason: "denied" });
  });

  it("does not block the legitimate tools that ship today", () => {
    for (const tool of allTools()) {
      expect(isDeniedTool(tool.key), `${tool.key} is wrongly caught by the deny list`).toBe(false);
    }
  });
});

describe("gateToolCall", () => {
  it("refuses a tool that does not exist rather than passing it through", () => {
    expect(gateToolCall({ mode: "full_mode", toolKey: "crm.doWhateverIWant", tier: undefined, planSatisfied: true })).toEqual({
      allowed: false,
      reason: "unknown_tool",
    });
  });

  it("refuses a tool the workspace's plan does not reach", () => {
    expect(gateToolCall({ mode: "full_mode", toolKey: "accounting.summary", tier: "READ", planSatisfied: false })).toEqual({
      allowed: false,
      reason: "plan_gated",
    });
  });

  it("allows a legitimate full_mode call", () => {
    expect(gateToolCall({ mode: "full_mode", toolKey: "crm.pipelineSummary", tier: "READ", planSatisfied: true })).toEqual({ allowed: true });
  });
});

describe("Instagram auto-publishing cannot be reached through the chat", () => {
  it("has no publish tool in the table at all", () => {
    expect(allTools().some((t) => /publish/i.test(t.key))).toBe(false);
  });

  it("drafts posts in manual mode — the publish cron only fires on mode 'auto'", () => {
    // src/app/api/cron/instagram-publish/route.ts selects
    // { mode: "auto", status: "PENDING", scheduledFor: <= now } and publishes
    // with no human action. A draft created as "auto" would therefore publish
    // itself, which is exactly what the locked rule forbids.
    expect(__DRAFT_MODE_FOR_TESTS).toBe("manual");
  });

  it("keeps the social domain at DRAFT tier or below — no COMMIT", () => {
    const socialTools = allTools().filter((t) => t.capabilityKey === "social");
    expect(socialTools.length).toBeGreaterThan(0);
    for (const tool of socialTools) {
      expect(tool.tier, `${tool.key} must not be COMMIT`).not.toBe("COMMIT");
    }
  });
});

describe("accounting never posts to the ledger from the chat", () => {
  it("exposes no COMMIT tool — its write path is the existing human-approved proposal queue", () => {
    const accountingTools = allTools().filter((t) => t.capabilityKey === "accounting");
    expect(accountingTools.length).toBeGreaterThan(0);
    for (const tool of accountingTools) {
      expect(tool.tier, `${tool.key} must not be COMMIT`).not.toBe("COMMIT");
    }
  });

  it("gates every accounting tool behind the CRM add-on", () => {
    for (const tool of allTools().filter((t) => t.capabilityKey === "accounting")) {
      expect(tool.planSatisfied, `${tool.key} must declare a plan gate`).toBeTruthy();
    }
  });
});

describe("COMMIT tools", () => {
  it("all define summarize(), so the confirmation card is built from validated args and not from model prose", () => {
    const commitTools = allTools().filter((t) => t.tier === "COMMIT");
    expect(commitTools.length).toBeGreaterThan(0);
    for (const tool of commitTools) {
      expect(typeof tool.summarize, `${tool.key} must define summarize()`).toBe("function");
    }
  });

  it("expire, so a stale confirmation button in an old tab cannot fire a write hours later", () => {
    expect(ACTION_TTL_MS).toBeGreaterThan(0);
    expect(ACTION_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});

describe("the tool table itself", () => {
  it("covers exactly the approved domains (the four from Phase 4, plus SEO added on the owner's approval)", () => {
    const capabilities = Array.from(new Set(allTools().map((t) => t.capabilityKey))).sort();
    expect(capabilities).toEqual(["accounting", "ceo", "crm", "seo", "social"]);
  });

  it("resolves every tool by its own key", () => {
    for (const tool of allTools()) expect(getTool(tool.key)?.key).toBe(tool.key);
  });

  it("gives the strategy domain read-only access", () => {
    for (const tool of allTools().filter((t) => t.capabilityKey === "ceo")) {
      expect(tool.tier).toBe("READ");
    }
  });
});
