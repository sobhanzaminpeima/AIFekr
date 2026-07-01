import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";

function hashPassword(password) {
  return createHash("sha256").update(password + JWT_SECRET).digest("hex");
}

async function main() {
  console.log("🌱 Seeding database...");

  // --- Phone users (OTP 1234) ---
  await prisma.user.upsert({
    where: { phone: "09000000001" },
    update: { name: "کاربر تست", plan: "PRO", credits: 9999 },
    create: { phone: "09000000001", name: "کاربر تست", role: "USER", plan: "PRO", credits: 9999 },
  });

  await prisma.user.upsert({
    where: { phone: "09000000002" },
    update: { name: "مدیر سیستم", role: "ADMIN", plan: "PRO", credits: 99999 },
    create: { phone: "09000000002", name: "مدیر سیستم", role: "ADMIN", plan: "PRO", credits: 99999 },
  });

  await prisma.user.upsert({
    where: { phone: "09000000000" },
    update: { name: "سوپر ادمین", role: "SUPER_ADMIN", plan: "PRO", credits: 999999 },
    create: { phone: "09000000000", name: "سوپر ادمین", role: "SUPER_ADMIN", plan: "PRO", credits: 999999 },
  });

  // --- Email users (password login) ---
  await prisma.user.upsert({
    where: { email: "user@ai.test" },
    update: { passwordHash: hashPassword("User@1234"), name: "کاربر عادی", plan: "PRO", credits: 9999 },
    create: {
      email: "user@ai.test",
      passwordHash: hashPassword("User@1234"),
      name: "کاربر عادی",
      role: "USER",
      plan: "PRO",
      credits: 9999,
    },
  });
  console.log("✅ Email User: user@ai.test / User@1234");

  await prisma.user.upsert({
    where: { email: "admin@ai.test" },
    update: { passwordHash: hashPassword("Admin@1234"), name: "ادمین سیستم", role: "ADMIN", plan: "PRO", credits: 99999 },
    create: {
      email: "admin@ai.test",
      passwordHash: hashPassword("Admin@1234"),
      name: "ادمین سیستم",
      role: "ADMIN",
      plan: "PRO",
      credits: 99999,
    },
  });
  console.log("✅ Email Admin: admin@ai.test / Admin@1234");

  await prisma.user.upsert({
    where: { email: "super@ai.test" },
    update: { passwordHash: hashPassword("Super@1234"), name: "سوپر ادمین", role: "SUPER_ADMIN", plan: "PRO", credits: 999999 },
    create: {
      email: "super@ai.test",
      passwordHash: hashPassword("Super@1234"),
      name: "سوپر ادمین",
      role: "SUPER_ADMIN",
      plan: "PRO",
      credits: 999999,
    },
  });
  console.log("✅ Email Super Admin: super@ai.test / Super@1234");

  // --- Prompts ---
  const prompts = [
    { id: "p1", title: "ایده کسب‌وکار", content: "یک ایده کسب‌وکار آنلاین با سرمایه کم برای من پیشنهاد بده", category: "کسب‌وکار", sortOrder: 1 },
    { id: "p2", title: "توضیح ساده", content: "این مفهوم را به زبان ساده توضیح بده:", category: "آموزش", sortOrder: 2 },
    { id: "p3", title: "برنامه غذایی", content: "یک برنامه غذایی سالم هفتگی برایم بنویس", category: "سلامت", sortOrder: 3 },
    { id: "p4", title: "کد پایتون", content: "یک اسکریپت پایتون برای [هدف] بنویس", category: "فناوری", sortOrder: 4 },
    { id: "p5", title: "ترجمه متن", content: "این متن را به فارسی روان ترجمه کن:", category: "عمومی", sortOrder: 5 },
    { id: "p6", title: "خلاصه مقاله", content: "این مقاله را در ۵ نکته کلیدی خلاصه کن:", category: "آموزش", sortOrder: 6 },
  ];
  for (const p of prompts) {
    await prisma.prompt.upsert({ where: { id: p.id }, update: {}, create: p });
  }
  console.log("✅ Prompts seeded");

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 ورود با ایمیل (تب ایمیل در صفحه لاگین)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 کاربر:      user@ai.test    / User@1234
🛡️  ادمین:      admin@ai.test   / Admin@1234
⚡ سوپر ادمین: super@ai.test   / Super@1234
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 ورود با موبایل (کد OTP همیشه: 1234)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 کاربر:      09000000001
🛡️  ادمین:      09000000002
⚡ سوپر ادمین: 09000000000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
