// Refresh the requested USD base price and preserve existing credit allocations and authored copy.
const { PrismaClient } = require("@prisma/client");
require(require.resolve("@next/env", { paths: [require.resolve("next/package.json")] })).loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
async function main() {
  const response = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!response.ok) throw new Error("FX provider unavailable; no price was changed");
  const rates = await response.json();
  if (rates.result !== "success" || !(rates.rates?.IRR > 0)) throw new Error("Invalid FX response");
  const priceUsd = 8000;
  const price = Math.round(80 * rates.rates.IRR / 10) * 10;
  const row = await prisma.package.upsert({
    where: { planCode: "STUDENT_FIRST_TWO_MONTHS" }, update: { priceUsd, price, market: "BOTH", isActive: true },
    create: { planCode: "STUDENT_FIRST_TWO_MONTHS", name: "پکیج دانشجویی — ۲ ماه — آفر اولین اشتراک", nameEn: "Student — first 2 months", market: "BOTH", price, priceUsd, duration: 30, credits: 1000, sortOrder: 15, isActive: true, color: "#ea580c", features: "داشبورد درس‌ها و جزوه‌ها\nتکلیف و برنامهٔ مطالعه\nزمان‌سنج و گزارش مطالعه\nگروه مطالعه و دعوت ایمیلی\nپروفایل و کارت اشتراک‌پذیر\n۱۰۰۰ کردیت برای کل ۶۰ روز\nابزارهای AI با مصرف کردیت", featuresEn: "Course and material workspace\nAssignments and study planning\nStudy timer and reports\nStudy groups and email invitations\nShareable profile and card\n1000 credits for all 60 days\nAI tools consume credits" },
  });
  await prisma.package.upsert({ where: { planCode: "STUDENT_MONTHLY" }, update: { price, priceUsd, market: "BOTH", isActive: true }, create: { name: "دانشجو — ماهانه", nameEn: "Student — monthly", planCode: "STUDENT_MONTHLY", price, priceUsd, market: "BOTH", duration: 30, credits: row.credits, features: row.features.replace("۶۰", "۳۰"), featuresEn: row.featuresEn.replace("60", "30"), sortOrder: 16, color: "#ea580c" } });
  await prisma.package.updateMany({ where: { planCode: "STUDENT_QUARTERLY" }, data: { isActive: false } });
  console.log(JSON.stringify({ planCode: row.planCode, priceToman: row.price / 10, priceUsd: (row.priceUsd ?? 0) / 100, credits: row.credits }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
