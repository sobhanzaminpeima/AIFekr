import { describe, expect, it } from "vitest";
import { LIVE_PROMPT, liveCostUsd, spokenReply, speechLanguage, turnCredits } from "./service";

describe("AIFekr Live", () => {
  it("prices a turn per started 100 spoken characters", () => {
    const costs = { turn: 2, per100: 7 };
    expect(turnCredits(1, costs)).toBe(9);
    expect(turnCredits(100, costs)).toBe(9);
    expect(turnCredits(101, costs)).toBe(16);
    expect(turnCredits(600, costs)).toBe(44);
  });

  it("speaks plain text and cuts a long answer at a sentence end", () => {
    expect(spokenReply("**Hi** there, see [docs](https://x.y) `now`\n\n<SUGGESTIONS>[\"a\"]</SUGGESTIONS>")).toBe("Hi there, see docs now");
    const long = "First sentence here. ".repeat(40);
    const out = spokenReply(long, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith(".")).toBe(true);
  });

  it("reads Persian answers in Persian and others in the visitor's language", () => {
    expect(speechLanguage("سلام، خوبی؟", "en")).toBe("fa");
    expect(speechLanguage("Hallo!", "de")).toBe("de");
    expect(speechLanguage("Hello", "fa")).toBe("en");
  });

  it("tells the assistant who it is and not to repeat itself", () => {
    expect(LIVE_PROMPT).toContain("You are AIFekr Live");
    expect(LIVE_PROMPT).toMatch(/never say you don't know what you are/i);
    expect(LIVE_PROMPT).toMatch(/Never repeat yourself/);
  });

  it("costs speech by the credits ElevenLabs billed, falling back to characters", () => {
    expect(liveCostUsd(0.001, 0.08, 180, 81)).toBeCloseTo(0.00748, 6);
    expect(liveCostUsd(null, 0.08, 180, null)).toBeCloseTo(0.0144, 6);
    expect(liveCostUsd(0.001, undefined, 180, 81)).toBeNull();
  });
});
