import { describe, it, expect, vi } from "vitest";

// improvePlan imports the model router at module load; the pure parsing helpers do not need it.
vi.mock("@/lib/ai/router", () => ({ routedStreamChat: vi.fn() }));

import { parseImprovePlan, failingChecks } from "./improvePlan";

describe("parseImprovePlan", () => {
  it("accepts a good plan, sorts fixes by priority and clamps lengths", () => {
    const plan = parseImprovePlan("Sure! " + JSON.stringify({
      summary: "s", title: "T".repeat(100), metaDescription: "M".repeat(300), h1: "H",
      fixes: [
        { priority: "low", issue: "a", action: "do a" },
        { priority: "high", issue: "b", action: "do b" },
        { priority: "weird", issue: "c", action: "do c" },
      ],
      contentIdeas: ["x", "y"],
    }));
    expect(plan).not.toBeNull();
    expect(plan!.title).toHaveLength(60);
    expect(plan!.metaDescription).toHaveLength(160);
    expect(plan!.fixes.map((f) => f.priority)).toEqual(["high", "medium", "low"]);
  });

  it("drops fixes that are missing an issue or an action", () => {
    const plan = parseImprovePlan(JSON.stringify({ title: "ok", fixes: [{ priority: "high", issue: "only issue" }, { issue: "i", action: "a" }] }));
    expect(plan!.fixes).toHaveLength(1);
  });

  it("caps the number of fixes and ideas", () => {
    const fixes = Array.from({ length: 30 }, (_, i) => ({ priority: "low", issue: `i${i}`, action: `a${i}` }));
    const plan = parseImprovePlan(JSON.stringify({ title: "t", fixes, contentIdeas: Array.from({ length: 20 }, (_, i) => `c${i}`) }));
    expect(plan!.fixes).toHaveLength(10);
    expect(plan!.contentIdeas).toHaveLength(5);
  });

  it("refuses unusable output instead of showing garbage", () => {
    expect(parseImprovePlan("I cannot help with that")).toBeNull();
    expect(parseImprovePlan("{not json}")).toBeNull();
    expect(parseImprovePlan("{}")).toBeNull();
  });

  it("ignores non-string field values (model or page tried to smuggle objects)", () => {
    const plan = parseImprovePlan(JSON.stringify({ title: { evil: true }, metaDescription: "fine", fixes: [] }));
    expect(plan!.title).toBe("");
    expect(plan!.metaDescription).toBe("fine");
  });
});

describe("failingChecks", () => {
  it("returns only non-passing checks with their measured detail", () => {
    const out = failingChecks([{ id: "g", titleFa: "", titleEn: "", titleDe: "", checks: [
      { id: "a", label: "A", status: "pass", detail: "ok" },
      { id: "b", label: "B", status: "fail", detail: "no meta" },
      { id: "c", label: "C", status: "warning", detail: "short" },
    ] }]);
    expect(out.map((c) => c.id)).toEqual(["b", "c"]);
  });
});
