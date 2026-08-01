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

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
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
