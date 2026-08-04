const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PACKAGES = [
  {
    planCode: "BASIC", name: "پایه", nameEn: "Basic", price: 1500000, duration: 30, credits: 2000,
    color: "#3b82f6", isFeatured: false, sortOrder: 1,
    features: ["چت نامحدود", "۵۰ تصویر در ماه", "۵ ویدیو در ماه", "مدل پیشرفته", "اولویت پردازش"].join("\n"),
  },
  {
    planCode: "PRO", name: "حرفه‌ای", nameEn: "Pro", price: 3500000, duration: 30, credits: 6000,
    color: "#ea580c", isFeatured: true, sortOrder: 2,
    features: ["همه‌چیز نامحدود", "مدل برتر", "پشتیبانی اولویت", "تصویر و ویدیو HD"].join("\n"),
  },
  {
    planCode: "TEAM", name: "تیمی", nameEn: "Team", price: 8000000, duration: 30, credits: 20000,
    color: "#8b5cf6", isFeatured: false, sortOrder: 3,
    features: ["تا ۵ نفر", "همه امکانات حرفه‌ای", "داشبورد مشترک", "مدیریت اعضا", "فاکتور رسمی"].join("\n"),
  },
  // CRM add-on plans — purchased and billed separately from the AI-usage
  // plans above (see User.crmPlan / activatePlanForPayment's "CRM_" branch).
  // credits: 0 since these don't grant AI credits, only unlock CRM features.
  {
    planCode: "CRM_SOLO", name: "CRM انفرادی", nameEn: "CRM Solo", price: 6900000, priceUsd: 2900, market: "BOTH", duration: 30, credits: 0,
    color: "#0ea5e9", isFeatured: false, sortOrder: 10,
    features: ["پایپلاین و مخاطبین نامحدود", "فاکتور و قرارداد رسمی", "کاتالوگ محصولات", "اتوماسیون CRM", "تحلیل CRM Agent", "۱ کاربر"].join("\n"),
  },
  {
    planCode: "CRM_TEAM", name: "CRM تیمی", nameEn: "CRM Team", price: 19900000, priceUsd: 7900, market: "BOTH", duration: 30, credits: 0, crmSeatLimit: 5,
    color: "#0ea5e9", isFeatured: true, sortOrder: 11,
    features: ["همه امکانات CRM انفرادی", "تا ۵ کاربر (agent/manager/owner)", "گزارش عملکرد تیم", "تخصیص و انتقال مخاطبین بین اعضا", "برای seat بیشتر با پشتیبانی تماس بگیرید"].join("\n"),
  },
];

async function main() {
  for (const p of PACKAGES) {
    await prisma.package.upsert({ where: { planCode: p.planCode }, update: p, create: p });
  }
  console.log("seeded", PACKAGES.length, "packages");
}

main().finally(() => prisma.$disconnect());
