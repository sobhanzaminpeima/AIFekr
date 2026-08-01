import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.user.updateMany({ data: { onboardingDone: true } });
console.log(`Marked ${r.count} existing users as onboarding done`);
await p.$disconnect();
