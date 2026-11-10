import { describe, expect, it } from "vitest";
import { interestOf, proTools } from "./proTools";

const future = new Date(Date.now() + 30 * 86400000);
const none = { business: 0, content: 0, learning: 0 };

describe("pro tools in the sidebar", () => {
  it("opens what the plan includes and locks the rest with the plan that opens it", () => {
    const tools = proTools("fa", { plan: "PRO", planExpiry: future, role: "USER" }, none);
    const ceo = tools.find((t) => t.key === "ceo")!, social = tools.find((t) => t.key === "social")!;
    expect(social.unlocked).toBe(true);
    expect(ceo.unlocked).toBe(false);
    expect(ceo.requiredPlan).toBe("BUSINESS");
    expect(ceo.label).toBe("مشاور مدیرعامل");
  });
  it("an expired plan opens nothing beyond free", () => {
    const tools = proTools("en", { plan: "BUSINESS", planExpiry: new Date(Date.now() - 1000), role: "USER" }, none);
    expect(tools.every((t) => !t.unlocked || t.requiredPlan === null)).toBe(true);
    expect(tools.find((t) => t.key === "ceo")!.unlocked).toBe(false);
  });
  it("administrators see every tool open", () => {
    expect(proTools("en", { plan: "FREE", planExpiry: null, role: "SUPER_ADMIN" }, none).every((t) => t.unlocked)).toBe(true);
  });
  it("suggests at most two locked tools, closest to what the account uses", () => {
    const interest = interestOf([{ type: "tool", metadata: '{"feature":"crm.agent-run"}' }, { type: "tool", metadata: '{"feature":"sales"}' }, { type: "image", metadata: null }]);
    expect(interest.business).toBe(2);
    const tools = proTools("en", { plan: "FREE", planExpiry: null, role: "USER" }, interest);
    const suggested = tools.filter((t) => t.recommended);
    expect(suggested.length).toBeLessThanOrEqual(2);
    expect(suggested.every((t) => !t.unlocked)).toBe(true);
    expect(suggested[0].key).toBe("ceo");
  });
  it("suggests nothing without any usage", () => {
    expect(proTools("en", { plan: "FREE", planExpiry: null, role: "USER" }, none).some((t) => t.recommended)).toBe(false);
  });
});
