// One-off backfill: split every existing user's single `name` field into
// firstName/lastName (first word = firstName, the rest = lastName), per the
// user's own chosen approach. `name` itself is left untouched -- everything
// that already reads user.name keeps working unchanged; this only fills in
// the two new columns for users who don't have them yet.
// Run with: node scripts/split-existing-user-names.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { not: null }, firstName: null },
    select: { id: true, name: true },
  });

  let updated = 0;
  for (const u of users) {
    const trimmed = (u.name || "").trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || null;
    await prisma.user.update({ where: { id: u.id }, data: { firstName, lastName } });
    updated++;
  }
  console.log(`checked: ${users.length}, updated: ${updated}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
