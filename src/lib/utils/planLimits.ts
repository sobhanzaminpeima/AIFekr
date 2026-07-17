import { prisma } from "@/lib/db/prisma";
import { PLAN_LIMITS as DEFAULT_PLAN_LIMITS } from "@/lib/utils/credits";

export interface PlanLimitValues {
  dailyChats: number;
  monthlyImages: number;
  monthlyVideos: number;
  monthlyMusics: number;
  initialCredits: number;
}

export type PlanLimits = Record<string, PlanLimitValues>;

const SETTING_KEY = "planLimits";
const DEFAULTS: PlanLimits = DEFAULT_PLAN_LIMITS;

/**
 * Reads per-plan limits from SiteSetting (key "planLimits", JSON-encoded),
 * merged over the hardcoded defaults in credits.ts so a partially-edited
 * or missing setting still yields a complete, valid object. Falls back to
 * the hardcoded defaults entirely if the row doesn't exist yet or the DB
 * is unreachable — callers never need their own fallback logic.
 */
export async function getPlanLimits(): Promise<PlanLimits> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row) return structuredClone(DEFAULTS);
    const stored = JSON.parse(row.value) as Partial<Record<string, Partial<PlanLimitValues>>>;
    const merged: PlanLimits = structuredClone(DEFAULTS);
    for (const plan of Object.keys(merged)) {
      if (stored[plan]) merged[plan] = { ...merged[plan], ...stored[plan] };
    }
    return merged;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

/** Convenience accessor for a single plan's limits, with the same fallback guarantee as getPlanLimits(). */
export async function getLimitsForPlan(plan: string): Promise<PlanLimitValues> {
  const all = await getPlanLimits();
  return all[plan] ?? all.FREE;
}
