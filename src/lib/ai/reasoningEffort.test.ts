import { describe, expect, it } from "vitest";
import { gpt5ReasoningEffort } from "./providers";

describe("gpt-5 reasoning effort", () => {
  it("keeps 'minimal' for the original GPT-5 family", () => {
    for (const m of ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-mini-2025-08-07"]) expect(gpt5ReasoningEffort(m)).toBe("minimal");
  });
  it("uses 'none' for GPT-5.x point releases that reject 'minimal'", () => {
    for (const m of ["gpt-5.4-nano", "gpt-5.1", "gpt-5.2-mini"]) expect(gpt5ReasoningEffort(m)).toBe("none");
  });
});
