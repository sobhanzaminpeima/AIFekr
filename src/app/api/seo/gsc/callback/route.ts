export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { exchangeGscCode } from "@/lib/googleSearchConsole";
import { requireAuth } from "@/lib/auth/middleware";
import { verifyGscState } from "@/lib/seo/gscState";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  // The state is a signed, expiring token issued to one user (see gscState.ts).
  // Both the signature AND the logged-in session must agree, or someone could
  // finish consent with a forged state and overwrite another user's connection.
  const userId = verifyGscState(searchParams.get("state"));
  const session = await requireAuth(req);
  if (!userId || !session || session.id !== userId) {
    return NextResponse.redirect(`${appUrl}/seo?gsc=failed`);
  }
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
