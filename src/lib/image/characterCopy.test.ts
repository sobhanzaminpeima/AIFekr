import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CHARACTER_STRINGS, characterCopy } from "./characterCopy";

const classic = readFileSync(join(__dirname, "../../components/image/CharacterCreationPanel.tsx"), "utf8");

it("is word for word the classic character creator's wording", () => {
  const parts = CHARACTER_STRINGS.flat().flatMap((s) => s.split("{n}")).map((p) => p.replace(/"/g, '\\"')).filter((p) => p.trim());
  expect(parts.filter((p) => !classic.includes(p) && !classic.includes(p.replace(/\\"/g, '"')))).toEqual([]);
});
it("localizes styles and sample people", () => {
  const de = characterCopy("de");
  expect(de.strings["Generate Character Board"]).toBe("Charakter-Board erstellen");
  expect(de.genres[0]).toEqual({ value: "cinematic_drama", label: "Kinodrama" });
  expect(characterCopy("tr").samples.length).toBe(characterCopy("fa").samples.length);
});
