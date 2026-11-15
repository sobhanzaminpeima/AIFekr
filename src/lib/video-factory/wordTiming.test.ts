import { describe, expect, it } from "vitest";
import { phraseCues, wordsFromCharacters } from "./wordTiming";

const align = (text: string, step = 0.1) => ({ characters: [...text], character_start_times_seconds: [...text].map((_, i) => i * step), character_end_times_seconds: [...text].map((_, i) => i * step + step) });

describe("word timings from narration", () => {
  it("turns ElevenLabs character timings into words", () => {
    const words = wordsFromCharacters(align("سلام دنیا"));
    expect(words.map((w) => w.text)).toEqual(["سلام", "دنیا"]);
    expect(words[0].start).toBe(0);
    expect(words[1].start).toBeCloseTo(0.5);
    expect(words[1].end).toBeCloseTo(0.9);
  });
  it("is empty for a missing alignment", () => {
    expect(wordsFromCharacters(undefined)).toEqual([]);
  });
  it("groups words into short readable lines, breaking at punctuation and pauses", () => {
    const words = "one two three four five six seven eight nine.".split(" ").map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25 }));
    const lines = phraseCues(words);
    expect(lines[0].text).toBe("one two three four five six seven");
    expect(lines[1].text).toBe("eight nine.");
    const paused = phraseCues([{ text: "a", start: 0, end: 0.2 }, { text: "b", start: 1, end: 1.2 }]);
    expect(paused.map((l) => l.text)).toEqual(["a", "b"]);
  });
});
