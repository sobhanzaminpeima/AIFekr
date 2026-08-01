import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const plans = [
  {
    planCode: "ECHO",
    name: "اکو",
    nameEn: "Echo",
    price: 1490000,
    priceUsd: null,
    market: "IR",
    duration: 30,
    credits: 300,
    features:
      "چت با مدل‌های پایه\n۵۰ پیام در هر ۳ ساعت\n۱۵ تصویر در روز\nبدون تبلیغات\nپشتیبانی ایمیلی",
    isActive: true,
    isFeatured: false,
    color: "#6366f1",
    sortOrder: 1,
  },
  {
    planCode: "PLUS",
    name: "پلاس",
    nameEn: "Plus",
    price: 4490000,
    priceUsd: 1900,
    market: "BOTH",
    duration: 30,
    credits: 800,
    features:
      "مدل‌های پیشرفته (Claude Sonnet، GPT-5، Gemini Pro)\n۱۰۰ پیام در هر ۳ ساعت\nتصویر نامحدود\nساخت موزیک با Suno\nکاوش عمیق (Deep Research)\nبدون تبلیغات",
    isActive: true,
    isFeatured: true,
    color: "#ea580c",
    sortOrder: 2,
  },
  {
    planCode: "PRO",
    name: "پرو",
    nameEn: "Pro",
    price: 12900000,
    priceUsd: 4900,
    market: "BOTH",
    duration: 30,
    credits: 2000,
    features:
      "مدل‌های حرفه‌ای (Claude Opus، GPT-5 Sol، o3)\n۱۵۰ پیام در هر ۳ ساعت\nتصویر نامحدود با Midjourney\n۲۰ ویدیو در هفته\nساخت موزیک\nساخت وبسایت هوشمند\nسرعت پاسخ بالاتر",
    isActive: true,
    isFeatured: false,
    color: "#8b5cf6",
    sortOrder: 3,
  },
  {
    planCode: "ALPHA",
    name: "الفا",
    nameEn: "Alpha",
    price: 39900000,
    priceUsd: 9900,
    market: "BOTH",
    duration: 30,
    credits: 8000,
    features:
      "همه امکانات پرو\n۷۵۰ پیام در هر ۳ ساعت\n۱۰۰ ویدیو در هفته\nدسترسی زودهنگام به قابلیت‌های جدید\nپشتیبانی VIP اولویت‌دار",
    isActive: true,
    isFeatured: false,
    color: "#f59e0b",
    sortOrder: 4,
  },
  {
    planCode: "STARTER_USD",
    name: "Starter",
    nameEn: "Starter",
    price: 0,
    priceUsd: 900,
    market: "INTL",
    duration: 30,
    credits: 300,
    features:
      "Basic AI models\n50 messages per 3 hours\n15 images per day\nNo ads\nEmail support",
    isActive: true,
    isFeatured: false,
    color: "#6366f1",
    sortOrder: 11,
  },
  {
    planCode: "PLUS_USD",
    name: "Plus",
    nameEn: "Plus",
    price: 0,
    priceUsd: 1900,
    market: "INTL",
    duration: 30,
    credits: 800,
    features:
      "Advanced models (Claude Sonnet, GPT-5, Gemini Pro)\n100 messages per 3 hours\nUnlimited image generation\nMusic generation (Suno)\nDeep Research\nNo ads",
    isActive: true,
    isFeatured: true,
    color: "#ea580c",
    sortOrder: 12,
  },
  {
    planCode: "PRO_USD",
    name: "Pro",
    nameEn: "Pro",
    price: 0,
    priceUsd: 4900,
    market: "INTL",
    duration: 30,
    credits: 2000,
    features:
      "Premium models (Claude Opus, GPT-5 Sol, o3)\n150 messages per 3 hours\nUnlimited images with Midjourney\n20 videos per week\nMusic generation\nAI Website builder\nFaster responses",
    isActive: true,
    isFeatured: false,
    color: "#8b5cf6",
    sortOrder: 13,
  },
  {
    planCode: "ULTRA_USD",
    name: "Ultra",
    nameEn: "Ultra",
    price: 0,
    priceUsd: 9900,
    market: "INTL",
    duration: 30,
    credits: 8000,
    features:
      "Everything in Pro\n750 messages per 3 hours\n100 videos per week\nEarly access to new features\nVIP priority support",
    isActive: true,
    isFeatured: false,
    color: "#f59e0b",
    sortOrder: 14,
  },
];

for (const plan of plans) {
  await prisma.package.upsert({
    where: { planCode: plan.planCode },
    create: plan,
    update: plan,
  });
  console.log("✓", plan.planCode);
}

await prisma.$disconnect();
console.log("Seeding complete.");
