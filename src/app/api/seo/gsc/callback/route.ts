export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { exchangeGscCode } from "@/lib/googleSearchConsole";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // we passed the user id as OAuth state
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/seo?gsc=failed`);
  }

  try {
    const redirectUri = `${appUrl}/api/seo/gsc/callback`;
    const { refreshToken } = await exchangeGscCode(code, redirectUri);
    if (!refreshToken) {
      // Google only issues a refresh_token on the first consent — if the user
      // already granted access before and we don't have one stored, they need
      // to revoke access at myaccount.google.com/permissions and reconnect.
      const existing = await prisma.gscConnection.findUnique({ where: { userId } });
      if (!existing) throw new Error("no refresh token issued and none on file");
      return NextResponse.redirect(`${appUrl}/seo?gsc=connected`);
    }

    await prisma.gscConnection.upsert({
      where: { userId },
      update: { refreshToken },
      create: { userId, refreshToken },
    });

    return NextResponse.redirect(`${appUrl}/seo?gsc=connected`);
  } catch (e) {
    console.error("GSC OAuth callback error:", e);
    return NextResponse.redirect(`${appUrl}/seo?gsc=failed`);
  }
}
