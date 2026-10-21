import { describe, expect, it } from "vitest";
import { chapterCount, configurationSchema, manifestSchema, policySchema, quote, subtitles, timeline } from "./domain";
const config = configurationSchema.parse({ durationSeconds: 3600, language: "fa", ratio: "16:9", mode: "REVIEW_GATES", quality: "SMART", budgetCap: 10000 });
const policy = policySchema.parse({ enabled: true, longFormEnabled: true, creditsPerChapter: 3, creditsPerRenderMinute: 2 });
export function syntheticManifest(chapters = 12, shots = 7) {
  return manifestSchema.parse({ chapters: Array.from({ length: chapters }, (_, ci) => ({ title: `Chapter ${ci}`, continuity: "TEST ONLY: synthetic continuity", shots: Array.from({ length: shots }, (_, si) => ({ id: `c${ci}-s${si}`, title: "TEST ONLY", narration: "روایت آزمایشی فارسی", visualPrompt: "Synthetic test fixture; no real generation" })) })) });
}
describe("Video Factory frame and budget contracts", () => {
  it("constructs a synthetic 60-minute film with no gaps or cumulative rounding drift", () => {
    const edit = timeline(syntheticManifest(), 3600);
    expect(chapterCount(3600)).toBe(12); expect(edit.totalFrames).toBe(86400);
    expect(edit.shots.reduce((sum, shot) => sum + shot.durationFrames, 0)).toBe(86400);
    for (let i = 1; i < edit.shots.length; i++) expect(edit.shots[i].startFrame).toBe(edit.shots[i - 1].startFrame + edit.shots[i - 1].durationFrames);
  });
  it("quotes configured rates and enforces hard project budgets", () => {
    expect(quote(config, policy).credits).toBe(156);
    expect(() => quote({ ...config, budgetCap: 155 }, policy)).toThrow("BUDGET_EXCEEDED");
    expect(() => quote(config, { ...policy, creditsPerChapter: null })).toThrow("PRICING_NOT_CONFIGURED");
    expect(() => quote(config, { ...policy, enabled: false })).toThrow("FACTORY_DISABLED");
    expect(() => quote(config, { ...policy, longFormEnabled: false })).toThrow("LONG_FORM_DISABLED");
    expect(() => quote({ ...config, quality: "FILM_STUDIO" }, policy)).toThrow("QUALITY_ADAPTER_NOT_CONFIGURED");
  });
  it("emits Unicode Persian captions with exact film endpoint and valid VTT header", () => {
    const edit = timeline(syntheticManifest(), 3600), srt = subtitles(edit, "srt", "fa"), vtt = subtitles(edit, "vtt", "fa");
    expect(srt).toContain("01:00:00,000"); expect(srt).toContain("\u202bروایت آزمایشی فارسی\u202c"); expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
  });
  it("rejects duplicate shot identity before timeline persistence", () => {
    const manifest = syntheticManifest(1, 2); manifest.chapters[0].shots[1].id = manifest.chapters[0].shots[0].id;
    expect(manifestSchema.safeParse(manifest).success).toBe(false);
  });
});
