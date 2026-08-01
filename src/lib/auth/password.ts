import { createHash } from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** New passwords are always hashed with bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Pre-bcrypt hashes: SHA-256(password + JWT_SECRET), 64 hex chars, no algorithm prefix. */
function legacyHash(password: string): string {
  return createHash("sha256").update(password + process.env.JWT_SECRET).digest("hex");
}

function isLegacyHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Verifies a password against a stored hash, transparently accepting the old
 * SHA-256 format left over from before the bcrypt migration. When a legacy
 * hash verifies successfully, `needsRehash` is true so the caller can
 * upgrade the stored hash to bcrypt on this login — existing users never
 * need to reset their password for the migration to complete.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isLegacyHash(storedHash)) {
    const valid = legacyHash(password) === storedHash;
    return { valid, needsRehash: valid };
  }
  const valid = await bcrypt.compare(password, storedHash);
  return { valid, needsRehash: false };
}
