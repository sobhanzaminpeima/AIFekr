import { describe, expect, it } from "vitest";
import { unifyAutomations } from "./unified";

const d = (iso: string) => new Date(iso);

describe("one automation list across the three silos", () => {
  const list = unifyAutomations({
    comment: [{ id: "c1", name: "", keyword: "صدا، voice", postId: "p1", followGateEnabled: true, publicReplyMessage: "ok", isActive: true, triggerCount: 4, createdAt: d("2026-11-01T00:00:00Z") }],
    direct: [{ id: "d1", name: "AI", triggerType: "ai_fallback", keywords: "", followGateEnabled: false, isActive: false, triggerCount: 0, createdAt: d("2026-11-05T00:00:00Z") }],
    crm: [{ id: "r1", name: "Stale", trigger: "stale_deal", condition: '{"days":3}', action: "create_task", isActive: true, createdAt: d("2026-11-03T00:00:00Z") }],
  });

  it("reads every silo as trigger, condition and action", () => {
    expect(list.find((a) => a.id === "c1")).toMatchObject({ kind: "instagram_comment", name: "صدا، voice", trigger: { type: "keyword_comment", keywords: ["صدا", "voice"] }, condition: { postId: "p1", followGate: true }, action: { type: "send_dm_and_reply" }, runs: 4 });
    expect(list.find((a) => a.id === "d1")).toMatchObject({ kind: "instagram_direct", action: { type: "ai_reply" }, trigger: { keywords: [] } });
    expect(list.find((a) => a.id === "r1")).toMatchObject({ kind: "crm", condition: { days: 3 }, runs: null });
  });

  it("lists active automations first, newest first", () => {
    expect(list.map((a) => a.id)).toEqual(["r1", "c1", "d1"]);
  });

  it("survives a malformed CRM condition", () => {
    expect(unifyAutomations({ comment: [], direct: [], crm: [{ id: "x", name: "x", trigger: "new_lead", condition: "{", action: "send_notification", isActive: true, createdAt: d("2026-11-01T00:00:00Z") }] })[0].condition).toBeNull();
  });
});
