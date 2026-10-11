import { packageUsdPrice } from "@/lib/plans/packagePricing";
import { prisma } from "@/lib/db/prisma";
import type { Lang } from "@/lib/i18n/server";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { getFxRates } from "@/lib/utils/currency";

export type PublicPlan = { termPrices?:string; baseCurrency?:string;category?:string; planCode: string; name: string; price: number | null; credits: number; duration: number; features: string[]; featured: boolean; crmSeats: number | null; teamSeats: number | null };
export { parseFeatures } from "./features";
import { parseFeatures } from "./features";
export async function getPublicPlans(lang: Lang, business: boolean | "student" = false): Promise<PublicPlan[] | null> {
    try {
    const rows = await prisma.package.findMany({ where: { isActive: true, publicVisible:true,publicationStatus:"PUBLISHED",category:business === "student" ? "STUDENT" : business ? "BUSINESS" : "PERSONAL" }, select: { termPrices:true,baseCurrency:true,category:true,planCode: true, name: true, nameEn: true, price: true, priceUsd: true, priceTry: true, credits: true, duration: true, features: true, featuresEn: true, isFeatured: true, crmSeatLimit: true, teamSeatLimit: true } });
    const rates = await getFxRates();
    return rows.map(p => ({ termPrices:p.termPrices,baseCurrency:p.baseCurrency,category:p.category,planCode: p.planCode, name: lang === "fa" ? p.name : p.nameEn || p.name, price: p.planCode === "FREE" ? 0 : (p.priceTry ?? p.priceUsd ?? p.price) > 0 ? packageUsdPrice(p, rates) : null, credits: p.credits, duration: p.duration, features: parseFeatures(lang === "fa" ? p.features : p.featuresEn || p.features), featured: p.isFeatured, crmSeats: p.crmSeatLimit, teamSeats: p.teamSeatLimit }));
  } catch { return null; }
}
export async function getPublicIndustries() {
  try { return await prisma.industryPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, nameEn: true, nameDe: true, tagline: true, taglineEn: true, taglineDe: true, emoji: true } }); } catch { return []; }
}
export { getCreditCosts };
