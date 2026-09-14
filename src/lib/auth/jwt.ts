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
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
