import { prisma } from "../src/lib/db/prisma";
import { GAMING_PLAN } from "../src/lib/video-factory/gamingShorts";

async function main() {
  const existing = await prisma.package.findUnique({ where: { planCode: GAMING_PLAN } });
  if (existing) {
    console.log("Existing Gaming Shorts offer preserved");
    return;
  }
  await prisma.package.create({ data: {
    planCode: GAMING_PLAN, category: "VIDEO_FACTORY", name: "سه شورت گیمینگ",
    nameEn: "Three gaming Shorts", description: "سه شورت از یک فایل حداکثر ۳۰ دقیقه‌ای، با بازبینی تیم، کاور، زیرنویس و اطلاعات انتشار. تحویل ۱ تا ۲ روز کاری.",
    duration: 30, credits: 0, price: 0, baseCurrency: "IRT", termPrices: "{}",
    entitlements: JSON.stringify({ modules: ["video-factory"], limits: { gamingShorts: 3, inputMaxSeconds: 1800 } }),
    features: "۳ شورت عمودی با بازبینی تیم\nیک فایل حداکثر ۳۰ دقیقه و ۲ گیگابایت\nکاور، زیرنویس قابل ویرایش و اطلاعات انتشار\nتحویل ۱ تا ۲ روز کاری",
    featuresEn: "3 team-reviewed vertical Shorts\nOne file up to 30 minutes and 2 GB\nCovers, editable captions and publishing details\n1–2 business days",
    isActive: false, publicVisible: false, publicationStatus: "DRAFT", market: "IR",
  } });
  console.log("Gaming Shorts draft prepared; price approval required");
}
main().catch(() => { console.error("Gaming draft preparation failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
