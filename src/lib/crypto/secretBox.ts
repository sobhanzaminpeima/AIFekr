import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Encryption at rest for third-party credentials we must be able to use later
 * (Google refresh tokens, WordPress application passwords). A database leak or
 * a stray backup must not hand out working access to customers' sites.
 *
 * AES-256-GCM, random 96-bit IV per value, stored as `enc:v1:<iv>:<tag>:<data>`
 * (base64url). Values WITHOUT that prefix are treated as legacy plaintext and
 * returned as-is, so rows written before this existed keep working until the
 * backfill script re-saves them -- no flag day, no downtime.
 *
 * Key: TOKEN_ENCRYPTION_KEY when set (preferred, rotate independently),
 * otherwise derived from JWT_SECRET.
 */
const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY (or JWT_SECRET) is required to encrypt stored credentials");
  return createHash("sha256").update("secretbox:" + raw).digest();
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (isEncrypted(plain)) return plain; // never double-encrypt
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext row
  const [iv, tag, data] = stored.slice(PREFIX.length).split(":");
  if (!iv || !tag || !data) throw new Error("malformed encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
