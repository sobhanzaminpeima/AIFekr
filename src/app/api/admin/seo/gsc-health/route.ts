export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secretBox";
import { getGscAccessToken, listGscSites, GscApiUnavailableError, GscReconnectRequiredError } from "@/lib/googleSearchConsole";

/**
 * Admin-only: does Search Console actually work from THIS server? Presence of
 * the env vars (what /admin/system shows) says nothing about whether Google
 * will answer, and the user-facing error used to say "reconnect" even when the
 * real cause was our own Google Cloud setup. This makes a real call with a
 * connected user's token and reports which case it is, with the fix.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const configured = !!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID && !!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
  const connections = await prisma.gscConnection.count();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/seo/gsc/callback`;
  const base = { configured, connections, redirectUri };

  if (!configured) {
    return NextResponse.json({ ...base, status: "not_configured", fix: "Set GOOGLE_SEARCH_CONSOLE_CLIENT_ID and GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET in .env.local, then restart." });
  }

  // Probe with each connection in turn until one gives a definitive answer about the API itself.
  const rows = await prisma.gscConnection.findMany({ select: { userId: true, refreshToken: true }, take: 5, orderBy: { updatedAt: "desc" } });
  if (!rows.length) return NextResponse.json({ ...base, status: "no_connections", fix: "Connect one account under SEO > Search Console, then re-check." });

  const results: string[] = [];
  for (const r of rows) {
    try {
      const token = await getGscAccessToken(decryptSecret(r.refreshToken));
      const sites = await listGscSites(token);
      return NextResponse.json({ ...base, status: "ok", sitesVisibleToProbeAccount: sites.length });
    } catch (e) {
      if (e instanceof GscApiUnavailableError) {
        return NextResponse.json({
          ...base,
          status: "api_unavailable",
          fix: [
            "In Google Cloud Console, open the project that owns this OAuth client.",
            "APIs & Services > Library > enable 'Google Search Console API'.",
            "APIs & Services > OAuth consent screen: publish the app, or (while in Testing) add the connecting Google accounts as Test users.",
            `Credentials > your OAuth client > Authorized redirect URIs must include exactly: ${redirectUri}`,
            "Then re-run this check.",
          ],
        });
      }
      results.push(e instanceof GscReconnectRequiredError ? "reconnect_required" : "error");
    }
  }
  return NextResponse.json({ ...base, status: "all_probes_failed", probes: results, fix: "Every probed connection needs the user to reconnect (revoked/expired token); the API itself could not be judged." });
}
