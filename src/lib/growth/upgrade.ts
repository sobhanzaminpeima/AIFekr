import { prisma } from "@/lib/db/prisma";
import { effectivePlan, MODULE_PLANS } from "@/lib/auth/planGuard";
import { voicePolicy } from "@/lib/voice-studio/config";
import { getAvailableCredits } from "@/lib/utils/teamCredits";
import { growthModule } from "./modules";

const PLAN_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, BUSINESS: 3, TEAM: 4, AGENCY: 5 };

/** The User.plan a package sets on purchase -- mirrors activatePlanForPayment (TEAM_* packages grant TEAM). Null for add-ons. */
export function grantedPlan(planCode: string): string | null {
  if (/^(CRM_|CREDITS_|VOICE_|FIT_|STUDENT_)/.test(planCode)) return null;
  return planCode === "TEAM" || planCode.startsWith("TEAM_") ? "TEAM" : planCode;
}

export type PackageRow = { planCode: string; name: string; nameEn: string; price: number; priceUsd: number | null; market: string; duration: number; credits: number; category: string };
export type Recommendation = {
  planCode: string; name: string; nameEn: string;
  /** Exactly what the package table says; null when the package has no price in that market. */
  priceToman: number | null; priceUsdCents: number | null;
  durationDays: number; credits: number; checkoutUrl: string;
};

/**
 * Picks the cheapest published package that actually unlocks `moduleId` for
 * this user's market and is above their current plan. Pure, so it is unit-tested;
 * the caller passes rows straight from the Package table.
 */
export function pickRecommendation(rows: PackageRow[], opts: { moduleId: string; currentPlan: string; iran: boolean; allowedPlans: string[] | null; minPlan: string; returnTo: string }): Recommendation | null {
  const currentRank = PLAN_RANK[opts.currentPlan] ?? 0;
  const candidates = rows.filter(r => {
    const plan = grantedPlan(r.planCode);
    if (!plan || r.category !== "PERSONAL") return false;
    if (opts.iran ? !(["IR", "BOTH"].includes(r.market) && r.price > 0) : !(["INTL", "BOTH"].includes(r.market) && (r.priceUsd ?? 0) > 0)) return false;
    if (opts.allowedPlans) return opts.allowedPlans.includes(plan) && plan !== opts.currentPlan;
    const rank = PLAN_RANK[plan];
    return rank !== undefined && rank >= (PLAN_RANK[opts.minPlan] ?? 0) && rank > currentRank;
  }).sort((a, b) => opts.iran ? a.price - b.price : (a.priceUsd ?? 0) - (b.priceUsd ?? 0));
  const r = candidates[0];
  if (!r) return null;
  return {
    planCode: r.planCode, name: r.name, nameEn: r.nameEn,
    priceToman: opts.iran ? Math.round(r.price / 10) : null, priceUsdCents: opts.iran ? null : r.priceUsd,
    durationDays: r.duration, credits: r.credits,
    checkoutUrl: `/plans?plan=${encodeURIComponent(r.planCode)}&period=monthly&returnTo=${encodeURIComponent(opts.returnTo)}`,
  };
}

export async function upgradeFor(userId: string, moduleId: string) {
  const mod = growthModule(moduleId);
  if (!mod) return null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, planExpiry: true, country: true, currency: true, language: true } });
  const plan = effectivePlan(user as Parameters<typeof effectivePlan>[0]);
  const iran = user.currency ? user.currency === "IRT" : (user.country || "IR") === "IR";
  const allowedPlans = mod.id === "voice-studio" ? (await voicePolicy()).allowedPlans : null;
  const rows = await prisma.package.findMany({ where: { isActive: true, publicVisible: true, publicationStatus: "PUBLISHED" }, select: { planCode: true, name: true, nameEn: true, price: true, priceUsd: true, market: true, duration: true, credits: true, category: true } });
  const recommendation = pickRecommendation(rows, { moduleId: mod.id, currentPlan: plan, iran, allowedPlans, minPlan: MODULE_PLANS[mod.registryKey ?? ""] ?? "FREE", returnTo: mod.paths[0] });
  return { currentPlan: plan, credits: await getAvailableCredits(userId), recommendation };
}
