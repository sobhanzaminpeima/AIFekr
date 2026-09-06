import { describe, it, expect } from "vitest";
import {
  extractEditorScore, buildSystemPrompt, agentLabel, resolveCriticAgent, EDITOR_PASS_THRESHOLD,
} from "./contentPipeline";

describe("extractEditorScore", () => {
  // The score decides whether the writer is asked to redraft. A parse miss
  // raises nothing — it just silently disables the quality gate, so these
  // cases matter more than their size suggests.
  it("parses the pinned SCORE label", () => {
    expect(extractEditorScore("SCORE: 82\nNotes...")).toBe(82);
    expect(extractEditorScore("SCORE: 91\nHinweise...")).toBe(91);
  });

  it("still parses the Persian label it replaced, for runs already in flight", () => {
    expect(extractEditorScore("امتیاز: 82\nنکات...")).toBe(82);
    expect(extractEditorScore("امتیاز: ۸۲")).toBe(82);
    expect(extractEditorScore("امتیاز: ٨٢")).toBe(82);
  });

  it("survives the model bolding the label", () => {
    expect(extractEditorScore("**SCORE**: 77")).toBe(77);
  });

  it("clamps an above-range score to 100", () => {
    expect(extractEditorScore("SCORE: 150")).toBe(100);
  });

  it("returns undefined when no score line is present", () => {
    expect(extractEditorScore("no score here")).toBeUndefined();
    expect(extractEditorScore("")).toBeUndefined();
  });
});

describe("buildSystemPrompt", () => {
  it("writes the whole prompt in the requested language", () => {
    expect(buildSystemPrompt("writer", undefined, [], [], "fa")).toContain("نویسندهٔ");
    expect(buildSystemPrompt("writer", undefined, [], [], "en")).toContain('the team\'s "writer"');
    expect(buildSystemPrompt("writer", undefined, [], [], "de")).toContain("Autorin");
  });

  it("pins the output language per reader, not to Persian", () => {
    expect(buildSystemPrompt("writer", undefined, [], [], "fa")).toContain("فقط به فارسی");
    expect(buildSystemPrompt("writer", undefined, [], [], "en")).toContain("only in English");
    expect(buildSystemPrompt("writer", undefined, [], [], "de")).toContain("ausschließlich auf Deutsch");
  });

  it("keeps machine labels untranslated in every language", () => {
    for (const lang of ["fa", "en", "de"] as const) {
      expect(buildSystemPrompt("editor", undefined, [], [], lang)).toContain("SCORE:");
      expect(buildSystemPrompt("seo", undefined, [], [], lang)).toContain("SEO_TITLE:");
      expect(buildSystemPrompt("seo", undefined, [], [], lang)).toContain("SLUG:");
      expect(buildSystemPrompt("strategist", undefined, [], [], lang)).toContain("FINAL_TITLE:");
      // The critic keys its lessons by agentKey, never by a display name.
      expect(buildSystemPrompt("critic", undefined, [], [], lang)).toContain("ideaFinder:");
    }
  });

  it("defaults to Persian so existing callers keep their behaviour", () => {
    expect(buildSystemPrompt("writer", undefined, [])).toBe(buildSystemPrompt("writer", undefined, [], [], "fa"));
  });

  it("includes brand voice and lessons when provided", () => {
    expect(buildSystemPrompt("writer", "دوستانه و غیررسمی", [], [], "fa")).toContain("دوستانه و غیررسمی");
    expect(buildSystemPrompt("writer", undefined, ["Write shorter sentences"], [], "en")).toContain("Write shorter sentences");
    expect(buildSystemPrompt("writer", undefined, [], ["Comparison posts convert"], "de")).toContain("Comparison posts convert");
  });
});

describe("resolveCriticAgent", () => {
  it("resolves the agentKey the critic now emits", () => {
    expect(resolveCriticAgent("ideaFinder")).toBe("ideaFinder");
    expect(resolveCriticAgent("  seo  ")).toBe("seo");
  });

  it("still resolves the Persian names the critic used to emit", () => {
    expect(resolveCriticAgent("نویسنده")).toBe("writer");
    expect(resolveCriticAgent("متخصص سئو")).toBe("seo");
  });

  it("returns undefined for anything else rather than mis-attributing a lesson", () => {
    expect(resolveCriticAgent("Autorin")).toBeUndefined();
    expect(resolveCriticAgent("")).toBeUndefined();
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
