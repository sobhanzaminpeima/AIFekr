import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CREATE_STRINGS, createCopy } from "./createCopy";

const classic = ["app/(dashboard)/gallery/page.tsx", "app/(dashboard)/image/gallery/page.tsx", "components/ui/UpgradeRequiredModal.tsx"].map((f) => readFileSync(join(__dirname, "../..", f), "utf8")).join("\n");

it("is word for word the classic gallery pages' wording", () => {
  const parts = CREATE_STRINGS.flat().flatMap((s) => s.split("{n}")).filter((p) => p.trim());
  expect(parts.filter((p) => !classic.includes(p))).toEqual([]);
  expect(createCopy("de")["Delete this image?"]).toBe("Dieses Bild löschen?");
});
