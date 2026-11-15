import { describe, expect, it } from "vitest";
import { timedManifest } from "./narrationSync";
import { timeline } from "./domain";

const shot = (id: string, durationSeconds?: number) => ({ id, title: id, narration: "", visualPrompt: "", motion: "PUSH_IN" as const, notes: "", revision: 0, sfxPrompt: "", ...(durationSeconds ? { durationSeconds } : {}) });
const manifest = { characters: [], chapters: [{ title: "c", continuity: "", shots: [shot("a"), shot("b"), shot("c", 7), shot("d")] }] };

describe("narration sync", () => {
  it("times voiced shots to their clip, keeps creator-set times, gives silent shots a short still", () => {
    const timed = timedManifest(manifest as never, { a: 2, b: 5.95 });
    expect(timed.chapters[0].shots.map((s) => s.durationSeconds)).toEqual([2.3, 6.3, 7, 3]);
  });
  it("is no longer an equal split once timed", () => {
    const timed = timedManifest(manifest as never, { a: 2, b: 6 });
    const frames = timeline(timed, 30).shots.map((s) => s.durationFrames);
    expect(new Set(frames).size).toBeGreaterThan(1);
    expect(frames.reduce((n, f) => n + f, 0)).toBe(30 * 24);
  });
  it("reallocates the last shot in a 30-second video so all eight clips fit", () => {
    const clips = [3.866,4.833,3.474,4.911,3.631,5.068,4.833,6.348];
    const original = { ...manifest, chapters: [{ ...manifest.chapters[0],
      shots: clips.map((_, i) => shot(String(i), i===7 ? 2 : 4)) }] };
    const voiceSeconds = Object.fromEntries(clips.map((seconds,i) => [String(i),seconds]));
    const edit = timeline(timedManifest(original,voiceSeconds,30),30);
    expect(edit.shots.at(-1)!.durationFrames).toBeGreaterThan(48);
    expect(edit.shots.every((s,i)=>clips[i] / (s.durationFrames / 24) <= 2)).toBe(true);
    expect(edit.shots.reduce((sum,s)=>sum+s.durationFrames,0)).toBe(720);
  });
  it("fails before rendering when the clips cannot fit within the speed cap", () => {
    expect(()=>timedManifest(manifest,{a:35,b:35},30)).toThrow("NARRATION_EXCEEDS_VIDEO_DURATION");
  });
});
