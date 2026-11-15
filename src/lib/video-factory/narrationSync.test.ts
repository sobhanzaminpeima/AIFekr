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
});
