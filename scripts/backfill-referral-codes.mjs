import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const p = new PrismaClient();

function generateCode() {
  return randomBytes(4).toString("hex");
}

const users = await p.user.findMany({ where: { referralCode: null }, select: { id: true } });
let count = 0;
for (const u of users) {
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await p.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!clash) break;
    code = generateCode();
  }
  await p.user.update({ where: { id: u.id }, data: { referralCode: code } });
  count++;
}
console.log(`Backfilled referral codes for ${count} users`);
await p.$disconnect();
