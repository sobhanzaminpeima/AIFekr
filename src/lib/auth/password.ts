import { createHash } from "crypto";

/** Matches the hashing used in /api/auth/register and /api/auth/login. */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password + process.env.JWT_SECRET).digest("hex");
}
