// Local UI review only. Refuses to seed any database other than the named fixture.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
if (process.env.DATABASE_URL !== "file:./uiux-preview.db") throw new Error("Use the isolated uiux-preview.db database");
const db = new PrismaClient();
async function main() {
  const pack = await db.industryPack.upsert({ where: { slug: "uiux-preview" }, update: {}, create: {
    slug: "uiux-preview", name: "کسب‌وکار آزمایشی", nameEn: "Preview business", emoji: "🏢", tagline: "محیط آزمایشی رابط کاربری", valueProposition: "UI review", targetCustomers: "[]", painPoints: "[]", agents: "[]", outcomes: "[]", kpis: "[]", color: "#ea580c", gradientFrom: "#ea580c", gradientTo: "#c2410c",
  } });
  const user = await db.user.upsert({ where: { email: "preview@example.invalid" }, update: {}, create: {
    email: "preview@example.invalid", name: "آزمایش رابط کاربری", role: "SUPER_ADMIN", plan: "TEAM", credits: 2500, aiCredits: 1000, mediaCredits: 500, voiceMinutes: 30,
    passwordHash: await bcrypt.hash("Preview-UI-2026!", 12), onboardingDone: true, language: "fa", industryPackId: pack.id, crmPlan: "TEAM",
  } });
  const features = ["دسترسی به ابزارهای هوشمند", "فضای کاری یکپارچه", "گزارش و تاریخچه فعالیت", "مدیریت تیم و همکاری", "پشتیبانی داخل پلتفرم", "امکانات پیشرفته"];
  const english = ["AI tools", "Unified workspace", "Activity reports and history", "Team collaboration", "In-app support", "Advanced features"];
  for (const [planCode, name, nameEn, priceUsd, credits] of [
    ["FREE", "رایگان", "Free", 0, 100], ["TEAM_STARTER", "تیم استارتر", "Team Starter", 2900, 1500], ["TEAM_GROWTH", "تیم رشد", "Team Growth", 7900, 5000],
    ["CRM_SOLO", "مدیریت مشتری فردی", "CRM Solo", 1900, 0], ["CRM_TEAM", "مدیریت مشتری تیمی", "CRM Team", 4900, 0],
    ["STUDENT_FIRST_TWO_MONTHS", "آفر اولین اشتراک", "Student welcome offer", 8000, 1500], ["STUDENT_MONTHLY", "اشتراک دانشجویی", "Student subscription", 8000, 1500],
  ]) await db.package.upsert({ where: { planCode }, update: {}, create: { planCode, name, nameEn, priceUsd, price: priceUsd * 1000, credits, market: "BOTH", duration: planCode === "STUDENT_FIRST_TWO_MONTHS" ? 60 : 30, features: JSON.stringify(features), featuresEn: JSON.stringify(english), isFeatured: planCode === "TEAM_GROWTH", teamSeatLimit: 5, crmSeatLimit: 5 } });
  for (const [key, value] of [["default_language", "fa"], ["bank_iban", "GB82WEST12345698765432"], ["bank_holder", "AIFEKR PREVIEW - TEST ONLY"], ["bank_currency", "TRY"], ["bank_iban_eur", "GB82WEST12345698765432"]]) {
    await db.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  for (const [id, status, receiptAt] of [["uiux-preview-payment", "PENDING", null], ["uiux-preview-review", "PENDING", new Date()], ["uiux-preview-approved", "SUCCESS", new Date()], ["uiux-preview-rejected", "REJECTED", new Date()]]) {
    await db.payment.upsert({ where: { id }, update: {}, create: { id, userId: user.id, plan: "TEAM_GROWTH", gateway: "bank_transfer", amount: 22515, transferMinor: 22515, transferCurrency: "EUR", periodMonths: 3, status, receiptAt, bankSnapshot: JSON.stringify({ iban: "GB82WEST12345698765432", holder: "AIFEKR PREVIEW - TEST ONLY" }), entitlementSnapshot: JSON.stringify({ credits: 5000, days: 90 }), reviewNote: status === "REJECTED" ? "Example: the receipt amount does not match the order." : null } });
  }
  console.log("Isolated UI preview fixtures ready.");
}
main().finally(() => db.$disconnect());
