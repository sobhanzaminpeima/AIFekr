export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getGscOAuthUrl } from "@/lib/googleSearchConsole";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID) {
    return NextResponse.json({ error: "GOOGLE_SEARCH_CONSOLE_CLIENT_ID تنظیم نشده" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const redirectUri = `${appUrl}/api/seo/gsc/callback`;
  const url = getGscOAuthUrl(redirectUri, user.id);
  return NextResponse.redirect(url);
}
