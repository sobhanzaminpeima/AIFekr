import { prisma } from "@/lib/db/prisma";
import { fixedPackagePrice } from "./fixedPrices";

/** Currencies checkout converts into; IRT also needs an admin-approved free-market rate (rates.ts approvedRate). */
const TARGETS = ["IRT", "TRY", "EUR"] as const;
type Target = (typeof TARGETS)[number];
const WARN_MS = 48 * 3600000;

/**
 * Whether checkout's exchange rates are usable, for the admin warning. A rate
 * past its validUntil makes approvedRate() throw, so any published package
 * without a fixed price in that currency cannot be quoted or bought until an
 * admin approves a new rate. Nothing here sets or changes a rate.
 */
export async function rateHealth(now = new Date()) {
  const packages = await prisma.package.findMany({
    where: { isActive: true, publicVisible: true, publicationStatus: "PUBLISHED" },
    select: { planCode: true, termPrices: true, baseCurrency: true, entitlements: true },
  });
  const out: { target: Target; status: "ok" | "expiring" | "expired"; validUntil: Date | null; blocked: string[] }[] = [];
  for (const target of TARGETS) {
    const latest = await prisma.billingExchangeRate.findFirst({
      where: { source: "USD", target, ...(target === "IRT" ? { rateType: "FREE_MARKET", approvedBy: { not: null } } : {}) },
      orderBy: { validUntil: "desc" },
      select: { validUntil: true },
    });
    const left = latest ? latest.validUntil.getTime() - now.getTime() : -1;
    const status = left <= 0 ? "expired" : left < WARN_MS ? "expiring" : "ok";
    // Packages that need this rate: a period without its own fixed price in the currency (and not priced in it already).
    const blocked = packages.filter((p) => {
      const periods = Object.keys(safeJson(p.termPrices));
      return (periods.length ? periods : ["monthly"]).some((period) => p.baseCurrency !== target && fixedPackagePrice(p, period, target) === null);
    }).map((p) => p.planCode);
    out.push({ target, status, validUntil: latest?.validUntil ?? null, blocked });
  }
  return out;
}

function safeJson(raw: string | null | undefined): Record<string, unknown> {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}
