export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signOwnerSessionToken, OWNER_COOKIE } from "@/lib/auth/ownerAuth";

/**
 * Skips the "email yourself a login link" round-trip for an owner who is
 * ALREADY holding a valid, unguessable statement link (/o/[token]) — that
 * token already proves they're the intended recipient of this property's
 * statements, exactly as strongly as a freshly emailed login link would.
 * Making them additionally type their own email, wait for a second email,
 * and click that too was pure friction with no security benefit.
 *
 * Only ever reached from a link INSIDE a statement email or the /o/[token]
 * page itself — never exposed as something to type in by hand, since the
 * share token is the only thing authenticating this request.
 */
export async function GET(req: NextRequest) {
  const shareToken = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  const statement = shareToken
    ? await prisma.accountingOwnerStatement.findFirst({
        where: { shareToken, status: "sent" },
        select: { property: { select: { ownerContactId: true } } },
      })
    : null;

  const contactId = statement?.property.ownerContactId;
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
