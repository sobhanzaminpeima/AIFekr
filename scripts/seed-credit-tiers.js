// Seeds the initial 4 credit-purchase tiers (Noqte-inspired: a most-discount
// bulk tier, a best-value middle tier, a mid tier, a small entry tier).
// Base rate assumed ~590 Toman/credit at list price (matches the reference
// screenshots' per-credit price before discount) -- an admin can edit every
// number afterward from /admin/credit-tiers.
// Run with: node scripts/seed-credit-tiers.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_RATE = 590; // Toman per credit at list price

const TIERS = [
  { creditsAmount: 600, discountPercent: 0, badge: null, sortOrder: 0 },
  { creditsAmount: 1500, discountPercent: 2, badge: null, sortOrder: 1 },
  { creditsAmount: 5000, discountPercent: 3, badge: "best_value", sortOrder: 2 },
  { creditsAmount: 15000, discountPercent: 4, badge: "most_discount", sortOrder: 3 },
];

async function main() {
  const existing = await prisma.creditPricingTier.count();
  if (existing > 0) { console.log("tiers already exist, skipping:", existing); return; }
  for (const t of TIERS) {
    const listPrice = t.creditsAmount * BASE_RATE;
    const priceToman = Math.round((listPrice * (1 - t.discountPercent / 100)) / 100) * 100;
    await prisma.creditPricingTier.create({ data: { ...t, priceToman } });
  }
  console.log("seeded", TIERS.length, "tiers");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
