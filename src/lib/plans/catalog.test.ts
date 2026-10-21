import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { IR_PLAN_CODES, USD_PLAN_CODES, planCodesForLang, sortByPlanLadder } from "./catalog";

/**
 * QA 2026-09-15, U04: the landing page selected "first 3 active packages by
 * sortOrder, no market filter" while /plans sold a different set, so the public
 * page advertised legacy plans at legacy prices — and showed Rial-only plans as
 * "Free" to international visitors, because their priceUsd is null.
 */
describe("plan catalog", () => {
  it("gives Iranian plan codes for fa and USD codes otherwise", () => {
    expect(planCodesForLang("fa")).toEqual(IR_PLAN_CODES);
    expect(planCodesForLang("en")).toEqual(USD_PLAN_CODES);
    expect(planCodesForLang("de")).toEqual(USD_PLAN_CODES);
  });

  it("drops packages outside the market's ladder and orders by it, not by sortOrder", () => {
    // Deliberately in the order the old landing query would have returned:
    // the legacy rows carry the lowest sortOrder values.
    const packages = [
      { planCode: "BASIC", sortOrder: 1 },
      { planCode: "TEAM", sortOrder: 3 },
      { planCode: "ALPHA", sortOrder: 9 },
      { planCode: "FREE", sortOrder: 8 },
      { planCode: "PLUS", sortOrder: 7 },
    ];
    expect(sortByPlanLadder(packages, IR_PLAN_CODES).map((p) => p.planCode)).toEqual(["FREE", "PLUS", "ALPHA"]);
  });

  it("never lets an international visitor be offered a Rial-only plan", () => {
    // STARTER_USD/PLUS_USD/... are the INTL rows; the Rial-only legacy codes
    // must not appear in the USD ladder at all.
    for (const code of ["BASIC", "TEAM", "ECHO"]) {
      expect(USD_PLAN_CODES).not.toContain(code);
    }
  });

  it("is the only place either page defines its plan list", () => {
    // Guards against a copy of the list drifting back into a page, which is
    // exactly how the landing/plans mismatch happened.
    const files = [
      "src/app/page.tsx",
      "src/app/(dashboard)/plans/page.tsx",
    ];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
      // A local re-declaration would look like `const IR_PLAN_CODES = [`.
      expect(src).not.toMatch(/const\s+(IR_PLAN_CODES|USD_PLAN_CODES)\s*=/);
    }
  });
});
