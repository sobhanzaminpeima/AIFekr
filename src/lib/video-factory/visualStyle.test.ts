import { describe, expect, it } from "vitest";
import { styleText } from "./visualStyle";
import { configurationSchema } from "./domain";

describe("visual style block", () => {
  it("is exactly the old style bible when no preset or bible is set (keeps paid image fingerprints)", () => {
    expect(styleText({ styleBible: "warm tones" })).toBe("warm tones");
    expect(styleText({ styleBible: "", visualStyle: "NONE", visualBible: { palette: "  " } })).toBe("");
  });
  it("adds the preset, the bible rows and the no-text rule", () => {
    const text = styleText({ styleBible: "1920s Tehran", visualStyle: "STICKMAN", visualBible: { palette: "sepia and teal", negative: "gore" } });
    expect(text).toContain("Stickman documentary");
    expect(text).toContain("1920s Tehran");
    expect(text).toContain("Palette: sepia and teal");
    expect(text).toContain("Avoid: gore");
    expect(text).toContain("No text, letters");
  });
  it("defaults keep old saved configurations valid", () => {
    const parsed = configurationSchema.parse({ durationSeconds: 60, language: "fa", ratio: "16:9", mode: "AUTOPILOT", quality: "SMART", budgetCap: 100 });
    expect(parsed.visualStyle).toBe("NONE");
    expect(parsed.visualBible.palette).toBe("");
    expect(() => configurationSchema.parse({ ...parsed, visualBible: { extra: "x" } })).toThrow();
  });
});
