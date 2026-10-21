import { describe, expect, it } from "vitest";
import { selectDirectRule } from "./directRules";
import { instagramWorkspaceScope } from "./workspaceScope";

const rules = [
  { id: "default", triggerType: "all_messages", keywords: "", response: "fallback" },
  { id: "ai", triggerType: "ai_fallback", keywords: "", response: "guidance" },
  { id: "pricing", triggerType: "keyword", keywords: "price, قیمت", response: "pricing" },
];

describe("selectDirectRule", () => {
  it("prioritizes a matching keyword over fallbacks", () => {
    expect(selectDirectRule(rules, "قیمت این ملک چنده؟")?.id).toBe("pricing");
  });

  it("normalizes unicode before matching", () => {
    expect(selectDirectRule(rules, "PRICE please")?.id).toBe("pricing");
  });

  it("chooses AI fallback before a fixed all-message fallback", () => {
    expect(selectDirectRule(rules, "سلام")?.id).toBe("ai");
  });

  it("uses the fixed fallback when AI fallback is absent", () => {
    expect(selectDirectRule([rules[0]], "hello")?.id).toBe("default");
  });

  it("does not match empty keywords", () => {
    expect(selectDirectRule([{ id: "empty", triggerType: "keyword", keywords: "" }], "hello")).toBeUndefined();
  });
});

describe("Instagram workspace scope", () => {
  it("keeps legacy null rows isolated instead of broadening to all businesses", () => {
    expect(instagramWorkspaceScope(null)).toEqual({ businessId: null });
    expect(instagramWorkspaceScope("business-a")).toEqual({ businessId: "business-a" });
  });
});
