import { createHmac, timingSafeEqual } from "crypto";

// Signs the OAuth `state` for connector flows so the callback can trust which
// tenant started it without a server-side session lookup. Same lightweight
// HMAC approach as the public 1980s share route.
const SECRET = process.env.JWT_SECRET || process.env.CRON_SECRET || "aifekr-leadgen";

export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(state: string, maxAgeMs = 15 * 60 * 1000): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    const [userId, ts, sig] = decoded.split(".");
    if (!userId || !ts || !sig) return null;
    const expected = createHmac("sha256", SECRET).update(`${userId}.${ts}`).digest("hex").slice(0, 32);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    if (Date.now() - Number(ts) > maxAgeMs) return null;
    return userId;
  } catch {
    return null;
  }
}
