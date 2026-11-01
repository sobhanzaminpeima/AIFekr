import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CREDITS_LABELS, CREDITS_STRINGS, creditsCopy } from "./creditsCopy";
import { extractCrmLabels, extractKeyedStrings } from "@/lib/crm/crmCopy.extract";

const src = readFileSync(join(__dirname, "../../components/billing/CreditsWorkspace.tsx"), "utf8");
it("is word for word the classic credit wallet's wording and labels", () => {
  expect(CREDITS_STRINGS).toEqual(extractKeyedStrings([src]));
  expect(CREDITS_LABELS).toEqual(extractCrmLabels(src));
});
it("localizes the page and names the AI tools", () => {
  const fa = creditsCopy("fa");
  expect(fa.strings["Buy Credits"]).toBe("خرید کردیت");
  expect(fa.labels.PLAN_LABEL.PRO).toBe("حرفه‌ای");
  expect(Object.keys(fa.tools).length).toBeGreaterThan(5);
});
