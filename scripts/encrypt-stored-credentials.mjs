// One-off backfill: encrypts GSC refresh tokens and WordPress app passwords that
// were stored in plaintext. Idempotent (already-encrypted rows are skipped) and
// safe to re-run. Usage:
//   DATABASE_URL=file:... TOKEN_ENCRYPTION_KEY=... node scripts/encrypt-stored-credentials.mjs [--dry]
// Must run with the SAME key the app uses, or the app cannot read the values back.
import { PrismaClient } from "@prisma/client";
import { createCipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";
const dry = process.argv.includes("--dry");
const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
if (!raw) { console.error("TOKEN_ENCRYPTION_KEY (or JWT_SECRET) is required"); process.exit(1); }
const key = createHash("sha256").update("secretbox:" + raw).digest();

function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

const prisma = new PrismaClient();
let gsc = 0, wp = 0;
for (const r of await prisma.gscConnection.findMany({ select: { id: true, refreshToken: true } })) {
  if (!r.refreshToken || r.refreshToken.startsWith(PREFIX)) continue;
  gsc++;
  if (!dry) await prisma.gscConnection.update({ where: { id: r.id }, data: { refreshToken: encrypt(r.refreshToken) } });
}
for (const r of await prisma.seoConnection.findMany({ select: { id: true, wpAppPassword: true } })) {
  if (!r.wpAppPassword || r.wpAppPassword.startsWith(PREFIX)) continue;
  wp++;
  if (!dry) await prisma.seoConnection.update({ where: { id: r.id }, data: { wpAppPassword: encrypt(r.wpAppPassword) } });
}
console.log(`${dry ? "[dry run] would encrypt" : "encrypted"}: ${gsc} GSC token(s), ${wp} WordPress password(s)`);
await prisma.$disconnect();
