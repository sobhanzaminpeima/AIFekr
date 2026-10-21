export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyState } from "@/lib/leadgen/connectorState";
import { metaExchangeCode, metaLongLivedUserToken, metaListPages, metaSubscribePageLeadgen } from "@/lib/leadgen/meta";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";

// Meta redirects the tenant's browser back here after they authorise. We
// exchange the code, upgrade to a long-lived token, then create one
// LeadSource per Page the tenant manages and subscribe each to the
// `leadgen` webhook. Graph calls go through the relay — if it's down this
// whole block throws and we bounce back with ?meta=failed.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  const back = (q: string) => NextResponse.redirect(`${appUrl}/lead-gen?${q}`);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const err = searchParams.get("error");

  if (err || !code || !state) return back("meta=failed");
  const userId = verifyState(state);
  if (!userId) return back("meta=failed");

  try {
    const redirectUri = `${appUrl}/api/leadgen/connectors/meta/callback`;
    const shortToken = await metaExchangeCode(code, redirectUri);
    const { token: longToken, expiresIn } = await metaLongLivedUserToken(shortToken);
    const pages = await metaListPages(longToken);

    if (pages.length === 0) return back("meta=nopages");

    const expiry = new Date(Date.now() + expiresIn * 1000);
    let connected = 0;
    const businessId = await activeBusinessIdFor(userId);
    for (const page of pages) {
      await prisma.leadSource.upsert({
        where: { userId_provider_externalId: { userId, provider: "meta", externalId: page.id } },
        update: { name: page.name, accessToken: page.accessToken, tokenExpiry: expiry, status: "active", lastError: null },
        create: { userId, businessId, provider: "meta", externalId: page.id, name: page.name, accessToken: page.accessToken, tokenExpiry: expiry, status: "active" },
      });
      await metaSubscribePageLeadgen(page.id, page.accessToken).catch(async (e) => {
        await prisma.leadSource.update({
          where: { userId_provider_externalId: { userId, provider: "meta", externalId: page.id } },
          data: { status: "error", lastError: e instanceof Error ? e.message : "subscribe failed" },
        }).catch(() => {});
      });
      connected++;
    }

    return back(`meta=connected&pages=${connected}`);
  } catch (e) {
    console.error("Meta lead connector callback error:", e);
    return back("meta=failed");
  }
}
