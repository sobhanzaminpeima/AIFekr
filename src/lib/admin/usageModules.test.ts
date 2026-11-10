import { describe, expect, it } from "vitest";
import { isMediaUsage, usageByModule } from "./usageModules";

const tool = (feature: string | null, credits = 2, cost = 0.01) => ({ type: "tool", metadata: feature ? JSON.stringify({ feature }) : null, credits, estimatedCostUsd: cost });

describe("usage by module", () => {
  it("separates SEO from the other text tools", () => {
    const rows = usageByModule([{ type: "tool", calls: 3, credits: 6, costUsd: 0.03 }], [tool("seo.analyze"), tool("seo.improve"), tool("ceo.advice")]);
    expect(rows.find((r) => r.module === "seo")).toMatchObject({ calls: 2, credits: 4 });
    expect(rows.find((r) => r.module === "ceo")).toMatchObject({ calls: 1 });
  });
  it("counts paid SEO research as SEO", () => {
    expect(usageByModule([], [{ type: "seo_research", metadata: null, credits: 12, estimatedCostUsd: 0.2 }])).toEqual([{ module: "seo", calls: 1, credits: 12, costUsd: 0.2 }]);
  });
  it("keeps other types and does not count tool requests twice", () => {
    const rows = usageByModule([{ type: "chat", calls: 5, credits: 5, costUsd: 0.05 }, { type: "tool", calls: 1, credits: 2, costUsd: 0.01 }], [tool("seo.analyze")]);
    expect(rows.reduce((sum, r) => sum + r.calls, 0)).toBe(6);
  });
  it("survives an unreadable note", () => {
    expect(usageByModule([], [{ type: "tool", metadata: "{", credits: 1, estimatedCostUsd: null }])[0].module).toBe("tool");
  });
});

describe("requests expected to have no token count", () => {
  it("covers media only", () => {
    expect(["image", "video", "music", "voice_studio_settlement"].every(isMediaUsage)).toBe(true);
    expect(["chat", "tool", "business_doctor"].some(isMediaUsage)).toBe(false);
  });
});
