export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyOwnerLinkToken, signOwnerSessionToken, OWNER_COOKIE } from "@/lib/auth/ownerAuth";

/** Exchanges the emailed one-time link token for a long-lived owner session cookie, then redirects into the portal. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const contactId = token ? verifyOwnerLinkToken(token) : null;

  if (!contactId) {
    return NextResponse.redirect(`${appUrl}/owner/login?expired=1`);
  }

  const res = NextResponse.redirect(`${appUrl}/owner`);
  res.cookies.set(OWNER_COOKIE, signOwnerSessionToken(contactId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}
