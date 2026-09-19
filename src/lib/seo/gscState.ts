import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed OAuth `state` for the Google Search Console connect flow.
 *
 * The state used to be the bare user id, and the callback trusted it without
 * any session check. Anyone could finish Google's consent screen with
 * `state=<victim id>` and overwrite the victim's Search Console connection with
 * their own token (or, replaying a link, bind someone else's). The state is now
 * an HMAC-signed, short-lived token, and the callback also requires the
 * logged-in user to be the user it was issued to.
 */
const TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is required to sign OAuth state");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update("gsc-state:" + payload).digest("base64url");
}

export function createGscState(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id the state was issued to, or null if forged, tampered or expired. */
export function verifyGscState(state: string | null | undefined, now = Date.now()): string | null {
  if (!state) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || typeof e !== "number" || e < now) return null;
    return u;
  } catch {
    return null;
  }
}
