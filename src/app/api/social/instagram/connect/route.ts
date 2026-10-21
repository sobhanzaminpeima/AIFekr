export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getOAuthUrl, getInstagramAppId } from "@/lib/instagram";
import { getInstagramRedirectUri } from "@/lib/instagram/urls";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  if (!getInstagramAppId()) {
    return NextResponse.json({ error: "INSTAGRAM_APP_ID تنظیم نشده — از داشبورد Meta، بخش Instagram API → API setup with Instagram login" }, { status: 500 });
  }

  const redirectUri = getInstagramRedirectUri();
  // OAuth state must not expose a user id or be forgeable. The short-lived,
  // HttpOnly cookie binds Meta's callback to this browser and workspace.
  const state = crypto.randomUUID();
  const businessId = await activeBusinessIdFor(user.id);
  const payload = Buffer.from(JSON.stringify({ state, userId: user.id, businessId })).toString("base64url");
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.INSTAGRAM_APP_SECRET || "";
  if (!secret) return NextResponse.json({ error: "تنظیم secret برای اتصال اینستاگرام الزامی است" }, { status: 500 });
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const pending = `${payload}.${signature}`;
  const response = NextResponse.redirect(getOAuthUrl(redirectUri, state));
  response.cookies.set("ig_oauth_pending", pending, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/api/social/instagram",
  });
  return response;
}
