import jwt from "jsonwebtoken";

// No insecure fallback — a missing JWT_SECRET must fail loudly at startup,
// not silently sign every token with a hardcoded string anyone could forge.
const JWT_SECRET: string = (() => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required and must not be empty.");
  }
  return process.env.JWT_SECRET;
})();

export interface JwtPayload {
  userId: string;
  role: string;
  plan: string;
}

// Was 15 minutes -- a `refresh_token` cookie was issued on every login but
// nothing ever read it back to mint a fresh access token, so the access
// token's own expiry was the *only* thing keeping a session alive. Users
// were being silently logged out every 15 minutes of real use and hitting
// "authentication required" mid-task. 7 days matches ordinary session
// expectations without touching the unused refresh-token plumbing.
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || payload.tokenKind || typeof payload.userId !== "string" || typeof payload.role !== "string" || typeof payload.plan !== "string") return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export const MOBILE_ACCESS_SECONDS = 15 * 60;
export function signMobileAccess(userId: string, sessionId: string): string {
  return jwt.sign({ userId, sessionId, tokenKind: "mobile-access" }, JWT_SECRET, {
    algorithm: "HS256", expiresIn: MOBILE_ACCESS_SECONDS, audience: "aifekr-mobile", issuer: "aifekr",
  });
}
export function verifyMobileAccess(token: string): { userId: string; sessionId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"], audience: "aifekr-mobile", issuer: "aifekr" });
    if (typeof payload === "string" || payload.tokenKind !== "mobile-access" || typeof payload.userId !== "string" || typeof payload.sessionId !== "string") return null;
    return { userId: payload.userId, sessionId: payload.sessionId };
  } catch { return null; }
}
