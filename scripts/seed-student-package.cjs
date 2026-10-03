// Publish the three-month offer while preserving historic purchases and credits.
const { PrismaClient } = require("@prisma/client");
require(require.resolve("@next/env", { paths: [require.resolve("next/package.json")] })).loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
async function main() {
  const code = "STUDENT_FIRST_THREE_MONTHS";
  const existing = await prisma.package.findUnique({ where: { planCode: code } });
  const legacy = await prisma.package.findUnique({ where: { planCode: "STUDENT_FIRST_TWO_MONTHS" } });
  const source = existing || legacy;
  const credits = source?.credits ?? 1000;
  const features = (source?.features || "داشبورد درس‌ها و جزوه‌ها\nبرنامهٔ مطالعه و گزارش\nگروه مطالعه\nابزارهای AI با مصرف کردیت").replaceAll("۶۰ روز", "۹۰ روز");
  const featuresEn = (source?.featuresEn || "Course and material workspace\nStudy planning and reports\nStudy groups\nAI tools consume credits").replaceAll("60 days", "90 days");
  const data = { name: "پکیج دانشجویی — ۳ ماه فقط ۸۰ دلار", nameEn: "Student — 3 months for $80", priceUsd: 8000, price: source?.price || 80000000, duration: 90, credits, features, featuresEn, market: "BOTH", isActive: true };
  if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ proposed: { planCode: code, ...data }, apply: "Run with --apply" })); return; }
  await prisma.$transaction(async tx => {
    await tx.package.upsert({ where: { planCode: code }, update: data, create: { planCode: code, ...data, sortOrder: 15, color: "#ea580c" } });
    await tx.package.updateMany({ where: { planCode: "STUDENT_FIRST_TWO_MONTHS" }, data: { isActive: false } });
  });
  console.log(JSON.stringify({ planCode: code, usdPrice: 80, duration: 90, credits }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
