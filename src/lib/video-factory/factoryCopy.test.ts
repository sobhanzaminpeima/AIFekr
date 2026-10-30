import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { FACTORY_STRINGS, factoryCopy } from "./factoryCopy";

const dir = join(__dirname, "../../components/video-factory");
const classic = ["VideoFactory.tsx", "ProjectStudios.tsx", "AdvancedStudio.tsx", "ProjectHistory.tsx", "QuickCreate.tsx"].map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

it("is word for word the classic video factory's wording", () => {
  const parts = FACTORY_STRINGS.flat().flatMap((s) => s.split(/\{\d\}/)).filter((p) => p.trim());
  expect(parts.filter((p) => !classic.includes(p) && !classic.includes(JSON.stringify(p).slice(1, -1)))).toEqual([]);
});
it("localizes the factory", () => {
  expect(factoryCopy("fa")["Estimate credits"]).toBe("برآورد اعتبار");
  expect(factoryCopy("de")["Video duration"]).toBe("Videodauer");
  expect(factoryCopy("tr")["Estimate credits"]).toBe("Estimate credits");
  expect(factoryCopy("en")["Approve & start · ~{0} credits"]).toBe("Approve & start · ~{0} credits");
});
