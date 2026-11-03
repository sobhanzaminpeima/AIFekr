import { describe, expect, it } from "vitest";
import { supportsEmotion } from "./emotions";
import { voiceSettingsSchema } from "./provider";

describe("voice mood", () => {
  it("is offered only on models that act on audio tags", () => {
    expect(supportsEmotion("eleven_v4")).toBe(true);
    expect(supportsEmotion("eleven_v4_turbo")).toBe(true);
    expect(supportsEmotion("eleven_v3")).toBe(true);
    expect(supportsEmotion("eleven_multilingual_v2")).toBe(false);
    expect(supportsEmotion("eleven_flash_v2_5")).toBe(false);
  });
  it("accepts a known mood and rejects anything else", () => {
    expect(voiceSettingsSchema.parse({ stability: 0.5, emotion: "calm" }).emotion).toBe("calm");
    expect(() => voiceSettingsSchema.parse({ emotion: "shouting [loud]" })).toThrow();
  });
});
