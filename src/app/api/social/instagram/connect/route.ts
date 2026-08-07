export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getOAuthUrl, getInstagramAppId } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!getInstagramAppId()) {
    return NextResponse.json({ error: "INSTAGRAM_APP_ID تنظیم نشده — از داشبورد Meta، بخش Instagram API → API setup with Instagram login" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const redirectUri = `${appUrl}/api/social/instagram/callback`;
  const url = getOAuthUrl(redirectUri, user.id);
  return NextResponse.redirect(url);
}
