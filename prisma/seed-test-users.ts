import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function hash(password: string) {
  const secret = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
  return createHash("sha256").update(password + secret).digest("hex");
}

async function main() {
  const users = [
    {
      name: "علی رضایی",
      email: "ali@test.com",
      password: "test1234",
      phone: "09111111111",
      role: "USER",
      plan: "FREE",
      credits: 500,
    },
    {
      name: "سارا محمدی",
      email: "sara@test.com",
      password: "test1234",
      phone: "09222222222",
      role: "USER",
      plan: "BASIC",
      credits: 1000,
    },
    {
      name: "Admin Test",
      email: "admin@test.com",
      password: "admin1234",
      phone: "09333333333",
      role: "ADMIN",
      plan: "PRO",
      credits: 9999,
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ email: u.email }, { phone: u.phone }] } });
    if (existing) {
      console.log(`⚠️  User ${u.email} already exists — updating password`);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: hash(u.password), name: u.name, role: u.role as "USER" | "ADMIN", plan: u.plan, credits: u.credits },
      });
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          phone: u.phone,
          passwordHash: hash(u.password),
          role: u.role as "USER" | "ADMIN",
          plan: u.plan,
          credits: u.credits,
        },
      });
      console.log(`✅ Created: ${u.email} / ${u.password}`);
    }
  }

  console.log("\n📋 Test Users:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const u of users) {
    console.log(`  ${u.role.padEnd(10)} ${u.email.padEnd(20)} ${u.password}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(console.error).finally(() => prisma.$disconnect());
