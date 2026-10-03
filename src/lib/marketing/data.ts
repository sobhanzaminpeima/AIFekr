import { prisma } from "@/lib/db/prisma";
import type { Lang } from "@/lib/i18n/server";
import { sortByPlanLadder } from "@/lib/plans/catalog";
import { getCreditCosts } from "@/lib/utils/creditCosts";

export type PublicPlan = { planCode: string; name: string; price: number | null; credits: number; duration: number; features: string[]; featured: boolean; crmSeats: number | null; teamSeats: number | null };
export function parseFeatures(raw: string | null): string[] {
  if (!raw) return [];
  if (raw.trim().startsWith("[")) {
    try { const values: unknown = JSON.parse(raw); return Array.isArray(values) ? values.filter((v): v is string => typeof v === "string") : []; } catch { return []; }
  }
  return raw.split("\n").map(v => v.trim()).filter(Boolean);
}
export async function getPublicPlans(lang: Lang, business = false): Promise<PublicPlan[] | null> {
  const codes = business ? ["CRM_SOLO", "CRM_TEAM", "TEAM_STARTER", "TEAM_GROWTH"] : ["FREE"];
  try {
    const rows = await prisma.package.findMany({ where: { isActive: true, planCode: { in: codes } }, select: { planCode: true, name: true, nameEn: true, price: true, priceUsd: true, credits: true, duration: true, features: true, featuresEn: true, isFeatured: true, crmSeatLimit: true, teamSeatLimit: true } });
    return sortByPlanLadder(rows, codes).map(p => ({ planCode: p.planCode, name: lang === "fa" ? p.name : p.nameEn || p.name, price: lang === "fa" ? (p.price > 0 || p.planCode === "FREE" ? Math.round(p.price / 10) : null) : p.priceUsd == null ? (p.planCode === "FREE" ? 0 : null) : p.priceUsd / 100, credits: p.credits, duration: p.duration, features: parseFeatures(lang === "fa" ? p.features : p.featuresEn || p.features), featured: p.isFeatured, crmSeats: p.crmSeatLimit, teamSeats: p.teamSeatLimit }));
  } catch { return null; }
}
export async function getPublicIndustries() {
  try { return await prisma.industryPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, nameEn: true, nameDe: true, tagline: true, taglineEn: true, taglineDe: true, emoji: true } }); } catch { return []; }
}
export { getCreditCosts };
