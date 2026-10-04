export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { metaConfigured, metaOAuthUrl } from "@/lib/leadgen/meta";
import { signState } from "@/lib/leadgen/connectorState";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (user.plan === "FREE") return forbiddenResponse();

  if (!metaConfigured()) {
    return NextResponse.json({ error: "META_APP_ID / META_APP_SECRET روی سرور تنظیم نشده" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  const redirectUri = `${appUrl}/api/leadgen/connectors/meta/callback`;
  return NextResponse.redirect(metaOAuthUrl(redirectUri, signState(user.id)));
}
