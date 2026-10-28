import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { ANON_COOKIE } from "./attribution";

/** The visitor's first-party anonymous id, or a new one (set it on the response with `setAnonCookie`). */
export function anonIdFor(req: NextRequest): { anonId: string; fresh: boolean } {
  const existing = req.cookies.get(ANON_COOKIE)?.value;
  if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) return { anonId: existing, fresh: false };
  return { anonId: randomUUID(), fresh: true };
}

export function setAnonCookie(res: NextResponse, anonId: string) {
  res.cookies.set(ANON_COOKIE, anonId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
}

/** Signed-in user id from the session cookie, without the access checks of requireAuth (tracking only). */
export function sessionUserId(req: NextRequest): string | null {
  const token = req.cookies.get("token")?.value;
  return token ? verifyToken(token)?.userId ?? null : null;
}

const secret = () => process.env.JWT_SECRET || "";

/** One-click unsubscribe token: HMAC of the user id; does not expire, cannot be forged without JWT_SECRET. */
export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(`growth-unsubscribe:${userId}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!secret() || !/^[A-Za-z0-9_-]{32}$/.test(token)) return false;
  const a = Buffer.from(unsubscribeToken(userId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
