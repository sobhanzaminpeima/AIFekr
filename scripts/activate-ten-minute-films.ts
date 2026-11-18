import { prisma } from "../src/lib/db/prisma";
import { packageSchema } from "../src/lib/billing/plans";

async function activate() {
  await prisma.$transaction(async tx => {
    for (const manual of [false, true]) {
      const planCode = manual ? "VF_ECONOMY_10" : "VF_AUTO_10";
      const price = manual ? 9_990_000 : 12_490_000;
      const { id, entitlements, termPrices, ...offer } = packageSchema.parse({
        planCode, category: "VIDEO_FACTORY", name: manual ? "یک فیلم اقتصادی ده‌دقیقه‌ای" : "یک فیلم خودکار ده‌دقیقه‌ای",
        nameEn: manual ? "One manual ten-minute film" : "One automatic ten-minute film",
        credits: 0, market: "IR", duration: 30, publicationStatus: "PUBLISHED", publicVisible: true,
        baseCurrency: "IRT", price: price * 10, termPrices: { monthly: price },
        entitlements: { modules: ["video-factory"], limits: { videoCount: 1, videoSeconds: 600,
          videoMaxSeconds: 600, manualDelivery: Number(manual) }, fixedPrices: { IRT: { monthly: price } } },
      });
      const data = { ...offer, entitlements: JSON.stringify(entitlements), termPrices: JSON.stringify(termPrices) };
      await tx.package.upsert({ where: { planCode }, create: data, update: data });
    }
  });
}
activate().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
