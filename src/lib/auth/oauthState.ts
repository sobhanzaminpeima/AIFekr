import { createHmac } from "crypto";

const SECRET = process.env.JWT_SECRET;

/**
 * Encode an OAuth state token: base64url( userId + ":" + timestamp + ":" + hmac )
 * Valid for 10 minutes. Prevents CSRF — the callback must verify this before
 * writing tokens to the user's account.
 */
export function encodeOAuthState(userId: string): string {
  if (!SECRET) throw new Error("JWT_SECRET is required for OAuth state signing");
  const ts = String(Date.now());
  const sig = createHmac("sha256", SECRET)
    .update(`${userId}:${ts}`)
    .digest("hex");
  const raw = `${userId}:${ts}:${sig}`;
  return Buffer.from(raw).toString("base64url");
}

/**
 * Decode and verify an OAuth state token.
 * Returns the userId if valid and not expired, or null otherwise.
 */
export function decodeOAuthState(state: string): string | null {
  try {
    if (!SECRET) return null;
    const raw = Buffer.from(state, "base64url").toString("utf-8");
    const parts = raw.split(":");
    if (parts.length < 3) return null;

    const userId = parts[0];
    const ts = parts[1];
    const sig = parts.slice(2).join(":");

    const expected = createHmac("sha256", SECRET)
      .update(`${userId}:${ts}`)
      .digest("hex");

    if (expected !== sig) return null;

    // 10-minute expiry
    if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;

    return userId;
  } catch {
    return null;
  }
}
