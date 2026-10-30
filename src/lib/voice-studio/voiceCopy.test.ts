import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { VOICE_STRINGS, voiceCopy } from "./voiceCopy";

const dir = join(__dirname, "../../components/voice-studio");
const classic = ["VoiceStudio.tsx", "GeneratePanel.tsx", "GenerationProgress.tsx"].map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

it("is word for word the classic voice studio's wording", () => {
  const parts = VOICE_STRINGS.flat().flatMap((s) => s.split(/\{\d\}/)).filter((p) => p.trim());
  expect(parts.filter((p) => !classic.includes(p))).toEqual([]);
});
it("localizes wording and error messages", () => {
  const de = voiceCopy("de");
  expect(de.strings["Generate audio"]).toBe("Audio generieren");
  expect(de.errors.PLAN_REQUIRED).toContain("Pro");
  expect(voiceCopy("fa").strings["Queued"]).toBe("در صف");
  expect(voiceCopy("fa").strings["Queued · 2"]).toBe("در صف تولید");
  expect(Object.keys(voiceCopy("tr").errors)).toEqual(Object.keys(voiceCopy("en").errors));
});
