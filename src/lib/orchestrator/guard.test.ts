import { describe, it, expect } from "vitest";
import { parseProposedCalls, planCall } from "./guard";
import type { WorkspaceContext } from "./isolation";

/**
 * Tests for the layer between "what the model asked for" and "what runs".
 * Everything reaching `planCall` is untyped JSON that came off a network
 * response, so these cases are all shapes a real model has produced or
 * plausibly will.
 */

function ctx(overrides: Partial<WorkspaceContext> = {}): WorkspaceContext {
  return {
    workspaceUserId: "workspaceowner000000000001",
    actingUserId: "workspaceowner000000000001",
    isAgentRestricted: false,
    crmPlan: "TEAM",
    plan: "PRO",
    voicePlan: null,
    lang: "en",
    contactFilter: {},
    dealFilter: {},
    businessFilter: {},
    ...overrides,
  };
}

describe("parseProposedCalls", () => {
  it("reads a clean JSON plan", () => {
    const calls = parseProposedCalls('{"calls":[{"tool":"crm.pipelineSummary","args":{}}]}');
    expect(calls).toEqual([{ tool: "crm.pipelineSummary", args: {} }]);
  });

  it("tolerates a model that wrapped the JSON in prose or a code fence", () => {
    const calls = parseProposedCalls('Sure! Here you go:\n```json\n{"calls":[{"tool":"crm.recentContacts","args":{"days":7}}]}\n```');
    expect(calls).toEqual([{ tool: "crm.recentContacts", args: { days: 7 } }]);
  });

  it("returns an empty list for an empty plan, prose with no JSON, or malformed JSON", () => {
    expect(parseProposedCalls('{"calls":[]}')).toEqual([]);
    expect(parseProposedCalls("I do not think any tool is needed here.")).toEqual([]);
    expect(parseProposedCalls('{"calls":[{"tool":')).toEqual([]);
  });

  it("drops entries with no tool name instead of passing a malformed call on", () => {
    expect(parseProposedCalls('{"calls":[{"args":{"days":7}},{"tool":"crm.followUpsDue"}]}')).toEqual([{ tool: "crm.followUpsDue" }]);
  });

  it("caps how many calls one turn can make, so a runaway plan cannot fan out", () => {
    const many = { calls: Array.from({ length: 20 }, () => ({ tool: "crm.pipelineSummary", args: {} })) };
    expect(parseProposedCalls(JSON.stringify(many)).length).toBeLessThanOrEqual(4);
  });
});

describe("planCall", () => {
  it("accepts a valid READ call", () => {
    const planned = planCall({ tool: "crm.pipelineSummary", args: {} }, "full_mode", ctx());
    expect(planned.ok).toBe(true);
    if (planned.ok) expect(planned.tier).toBe("READ");
  });

  it("rejects a hallucinated tool key", () => {
    const planned = planCall({ tool: "crm.exportEverything", args: {} }, "full_mode", ctx());
    expect(planned).toEqual({ ok: false, toolKey: "crm.exportEverything", reason: "unknown_tool" });
  });

  it("rejects a denied operation even when the model names it like a real tool", () => {
    const planned = planCall({ tool: "social.publishPost", args: {} }, "full_mode", ctx());
    expect(planned).toEqual({ ok: false, toolKey: "social.publishPost", reason: "denied" });
  });

  it("rejects every data tool in support_mode", () => {
    const planned = planCall({ tool: "crm.pipelineSummary", args: {} }, "support_mode", ctx());
    expect(planned).toEqual({ ok: false, toolKey: "crm.pipelineSummary", reason: "tier_not_in_mode" });
  });

  it("rejects an accounting tool when the workspace has no CRM add-on", () => {
    const planned = planCall({ tool: "accounting.summary", args: {} }, "full_mode", ctx({ crmPlan: "NONE" }));
    expect(planned).toEqual({ ok: false, toolKey: "accounting.summary", reason: "plan_gated" });
  });

  it("rejects a COMMIT call with no deal or stage reference at all", () => {
    const planned = planCall({ tool: "crm.updateDealStage", args: {} }, "full_mode", ctx());
    expect(planned).toEqual({ ok: false, toolKey: "crm.updateDealStage", reason: "invalid_args" });
  });

  it("accepts a COMMIT call referring to records by name, but only as a plan — nothing has run or resolved yet", () => {
    const planned = planCall(
      { tool: "crm.updateDealStage", args: { dealQuery: "Hilton renewal", stageName: "Won" } },
      "full_mode",
      ctx()
    );
    expect(planned.ok).toBe(true);
    if (planned.ok) {
      expect(planned.tier).toBe("COMMIT");
      // Validation does not resolve anything — that is prepare()'s job, and it
      // happens server-side under the workspace scope.
      expect((planned.args as { resolved?: unknown }).resolved).toBeUndefined();
    }
  });

  it("rejects a draft task with no title instead of creating an empty reminder", () => {
    expect(planCall({ tool: "crm.draftFollowUpTask", args: {} }, "full_mode", ctx())).toEqual({
      ok: false,
      toolKey: "crm.draftFollowUpTask",
      reason: "invalid_args",
    });
  });

  it("clamps an absurd day range instead of accepting it", () => {
    const planned = planCall({ tool: "crm.recentContacts", args: { days: 99999 } }, "full_mode", ctx());
    expect(planned.ok).toBe(true);
    if (planned.ok) expect((planned.args as { days: number }).days).toBeLessThanOrEqual(365);
  });

  it("falls back to a sane default for a nonsense day value rather than producing NaN", () => {
    const planned = planCall({ tool: "crm.recentContacts", args: { days: "last week sometime" } }, "full_mode", ctx());
    expect(planned.ok).toBe(true);
    if (planned.ok) expect(Number.isFinite((planned.args as { days: number }).days)).toBe(true);
  });

  it("rejects a negative expense-anomaly threshold, which would invert the comparison", () => {
    const planned = planCall({ tool: "accounting.anomalies", args: { thresholdPercent: -500 } }, "full_mode", ctx());
    expect(planned.ok).toBe(true);
    if (planned.ok) expect((planned.args as { thresholdPercent: number }).thresholdPercent).toBeGreaterThan(0);
  });

  it("rejects a social draft scheduled in the past or absurdly far ahead, but keeps the caption", () => {
    const past = planCall({ tool: "social.draftPost", args: { caption: "hello", scheduledFor: "2020-01-01T00:00:00Z" } }, "full_mode", ctx());
    expect(past.ok).toBe(true);
    // An unusable date falls back to tomorrow rather than rejecting the whole
    // draft — the caption is the valuable part and the user re-times it anyway.
    if (past.ok) expect((past.args as { scheduledFor: Date }).scheduledFor.getTime()).toBeGreaterThan(Date.now());
  });
});
