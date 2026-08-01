import { describe, it, expect } from "vitest";
import { extractEditorScore, buildSystemPrompt, agentLabel, EDITOR_PASS_THRESHOLD } from "./contentPipeline";

describe("extractEditorScore", () => {
  it("parses an ASCII digit score", () => {
    expect(extractEditorScore("امتیاز: 82\nنکات...")).toBe(82);
  });

  it("parses a Persian-digit score", () => {
    expect(extractEditorScore("امتیاز: ۸۲")).toBe(82);
  });

  it("parses an Arabic-Indic-digit score", () => {
    expect(extractEditorScore("امتیاز: ٨٢")).toBe(82);
  });

  it("clamps an above-range score to 100", () => {
    expect(extractEditorScore("امتیاز: 150")).toBe(100);
  });

  it("returns undefined when no score line is present", () => {
    expect(extractEditorScore("no score here")).toBeUndefined();
  });
});

describe("buildSystemPrompt", () => {
  it("always appends the Persian-only instruction", () => {
    const prompt = buildSystemPrompt("writer", undefined, []);
    expect(prompt).toContain("فقط به فارسی");
  });

  it("includes brand voice when provided", () => {
    const prompt = buildSystemPrompt("writer", "دوستانه و غیررسمی", []);
    expect(prompt).toContain("دوستانه و غیررسمی");
  });

  it("includes lessons when provided", () => {
    const prompt = buildSystemPrompt("writer", undefined, ["جملات کوتاه‌تر بنویس"]);
    expect(prompt).toContain("جملات کوتاه‌تر بنویس");
  });
});

describe("agentLabel", () => {
  it("returns the Persian label for a known agent", () => {
    expect(agentLabel("writer")).toBe("نویسنده");
  });
});

describe("EDITOR_PASS_THRESHOLD", () => {
  it("is a sane percentage threshold", () => {
    expect(EDITOR_PASS_THRESHOLD).toBeGreaterThan(0);
    expect(EDITOR_PASS_THRESHOLD).toBeLessThanOrEqual(100);
  });
});
