export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { exchangeCodeForToken, getLongLivedToken, findInstagramBusinessAccount } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // we passed the user id as OAuth state
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/social?instagram=failed`);
  }

  try {
    const redirectUri = `${appUrl}/api/social/instagram/callback`;
    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const { token: longToken, expiresIn } = await getLongLivedToken(shortToken);

    const igAccount = await findInstagramBusinessAccount(longToken);
    if (!igAccount) {
      return NextResponse.redirect(`${appUrl}/social?instagram=no-ig-account`);
    }

    await prisma.instagramConnection.upsert({
      where: { userId },
      update: {
        igUserId: igAccount.igUserId,
        igUsername: igAccount.igUsername,
        pageId: igAccount.pageId,
        accessToken: igAccount.pageAccessToken,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
      },
      create: {
        userId,
        igUserId: igAccount.igUserId,
        igUsername: igAccount.igUsername,
        pageId: igAccount.pageId,
        accessToken: igAccount.pageAccessToken,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
      },
    });

    return NextResponse.redirect(`${appUrl}/social?instagram=connected`);
  } catch (e) {
    console.error("Instagram OAuth callback error:", e);
    return NextResponse.redirect(`${appUrl}/social?instagram=failed`);
  }
}
