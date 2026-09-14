/**
 * The single list of which plan codes are actually on sale, per market.
 *
 * Existed only inside `src/app/(dashboard)/plans/page.tsx`, so the public
 * landing page selected its plans independently -- "first 3 active packages by
 * sortOrder, no market filter". That surfaced the legacy BASIC/PRO/TEAM rows on
 * the landing page while /plans sold ECHO/PLUS/ALPHA, at different prices, and
 * showed Rial-only packages to international visitors as "Free" because their
 * priceUsd is null (QA 2026-09-15, U04).
 *
 * Any new plan has to be added here to appear anywhere, which is the point:
 * one list, both pages.
 */

export const IR_PLAN_CODES = ["FREE", "ECHO", "PLUS", "PRO", "ALPHA"];
export const USD_PLAN_CODES = ["FREE", "STARTER_USD", "PLUS_USD", "PRO_USD", "ULTRA_USD"];

/** Plan codes on sale for the given UI language's default market. */
export function planCodesForLang(lang: string): string[] {
  return lang === "fa" ? IR_PLAN_CODES : USD_PLAN_CODES;
}

/**
 * Orders packages the way the plan ladder reads (cheapest first), rather than
 * by whatever sortOrder legacy rows happen to carry.
 */
export function sortByPlanLadder<T extends { planCode: string }>(packages: T[], codes: string[]): T[] {
  return packages
    .filter((p) => codes.includes(p.planCode))
    .sort((a, b) => codes.indexOf(a.planCode) - codes.indexOf(b.planCode));
}
