import { describe, expect, it } from "vitest";
import { extractJson, normalizeChapter } from "./lenientChapter";

const good = { title: "فصل اول", continuity: "", shots: [{ id: "s1", title: "شروع", narration: "متن یک", visualPrompt: "a stickman at a desk", motion: "PUSH_IN" }] };

describe("lenient chapter parsing for smaller writer models", () => {
  it("reads JSON wrapped in prose and code fences", () => {
    const text = "Here is the chapter:\n```json\n" + JSON.stringify(good) + "\n```\nHope this helps!";
    expect(normalizeChapter(extractJson(text)).shots[0].id).toBe("s1");
  });
  it("unwraps {chapter: …} and maps renamed keys, bad IDs and lower-case motions", () => {
    const loose = { chapter: { chapterTitle: "T", scenes: [{ shot_id: "shot 1!", voiceover: "hello", image_prompt: "a stickman", camera: "pan left", duration: 4, extra: true }, { id: "shot-1", text: "second", prompt: "x" }] } };
    const ch = normalizeChapter(loose);
    expect(ch.title).toBe("T");
    expect(ch.shots.map((s) => s.id)).toEqual(["shot-1", "c1-s2"]);
    expect(ch.shots[0]).toMatchObject({ narration: "hello", visualPrompt: "a stickman", motion: "PAN", durationSeconds: 4 });
    expect(ch.shots[1].motion).toBe("PUSH_IN");
  });
  it("repairs output cut off at the token limit by keeping complete shots", () => {
    const full = JSON.stringify({ ...good, shots: [good.shots[0], { ...good.shots[0], id: "s2" }, { ...good.shots[0], id: "s3" }] });
    const cut = full.slice(0, full.lastIndexOf('"s3"') + 10);
    const ch = normalizeChapter(extractJson(cut));
    expect(ch.shots.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
  it("refuses output with no usable shots with a clear code", () => {
    expect(() => normalizeChapter(extractJson("sorry, I cannot do that"))).toThrow("SCRIPT_FORMAT_INVALID");
    expect(() => normalizeChapter({ title: "x", shots: [] })).toThrow("SCRIPT_FORMAT_INVALID");
  });
  it("downgrades CHART/MAP without data to a normal motion", () => {
    const ch = normalizeChapter({ title: "t", shots: [{ id: "a", title: "t", narration: "n", visualPrompt: "p", motion: "chart" }] });
    expect(ch.shots[0].motion).toBe("PUSH_IN");
  });
});
