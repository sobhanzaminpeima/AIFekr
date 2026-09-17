import { prisma } from "@/lib/db/prisma";
import { CREDIT_COSTS as DEFAULT_CREDIT_COSTS } from "@/lib/utils/credits";

export type CreditCosts = Record<keyof typeof DEFAULT_CREDIT_COSTS, number>;

const SETTING_KEY = "creditCosts";

/**
 * Phase 5 of the monetization overhaul: admin-editable per-feature credit
 * costs (the master prompt's "Credit Rules"). Same SiteSetting-backed,
 * merge-over-defaults pattern as getPlanLimits() in planLimits.ts -- a
 * partially-edited or missing setting still yields a complete, valid object,
 * and every existing charge call site keeps working unchanged if this row
 * is never touched.
 */
export async function getCreditCosts(): Promise<CreditCosts> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row) return { ...DEFAULT_CREDIT_COSTS };
    const stored = JSON.parse(row.value) as Partial<CreditCosts>;
    return { ...DEFAULT_CREDIT_COSTS, ...stored };
  } catch {
    return { ...DEFAULT_CREDIT_COSTS };
  }
}
