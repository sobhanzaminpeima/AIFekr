export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getOAuthUrl, getMetaAppId } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!getMetaAppId()) {
    return NextResponse.json({ error: "META_APP_ID تنظیم نشده — ابتدا یک اپ در developers.facebook.com بسازید" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const redirectUri = `${appUrl}/api/social/instagram/callback`;
  const url = getOAuthUrl(redirectUri, user.id);
  return NextResponse.redirect(url);
}
