import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";
import { signToken } from "@/lib/auth/jwt";

/**
 * Bridges an AiFekr session into JARVIS (jarvis.aifekr.com) without either
 * app sharing a database — see jarvis/apps/api/core/security.py for the
 * receiving side. Mints a short-lived token (same JWT_SECRET both apps
 * read from env) and redirects with it + the profile fields JARVIS needs
 * to create its own user row (its JWT payload only carries userId/role/plan).
 */
export async function GET(req: NextRequest) {
  // req.url resolves to the internal PM2/Node origin (localhost:3000) behind
  // nginx, not the public host — build the real origin from the headers
  // nginx forwards (proxy_set_header Host / X-Forwarded-Proto) instead.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "aifekr.com";
  const origin = `${proto}://${host}`;

  const user = await requireAuth(req);
  if (!user) return NextResponse.redirect(new URL("/login?redirect=/api/jarvis-sso", origin));

  const full = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, phone: true, name: true } });
  const email = full?.email || full?.phone || `${user.id}@aifekr.local`;

  const ssoToken = signToken({ userId: user.id, role: user.role, plan: user.plan });

  const jarvisBase = process.env.JARVIS_BASE_URL || "https://jarvis.aifekr.com";
  const url = new URL("/sso", jarvisBase);
  url.searchParams.set("token", ssoToken);
  url.searchParams.set("email", email);
  if (full?.name) url.searchParams.set("name", full.name);

  return NextResponse.redirect(url);
}
