export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { findOpportunities } from "@/lib/seo/opportunities";
import { getGscAccessToken, querySearchAnalytics, GscReconnectRequiredError, GscApiUnavailableError } from "@/lib/googleSearchConsole";
import { decryptSecret } from "@/lib/crypto/secretBox";
import { gscMsg } from "@/lib/seo/gscMessages";
import { getServerLang } from "@/lib/i18n/server";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const conn = await prisma.gscConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: gscMsg(lang, "notConnected") }, { status: 400 });
  if (!conn.siteUrl) return NextResponse.json({ error: gscMsg(lang, "noSite") }, { status: 400 });

  try {
    const accessToken = await getGscAccessToken(decryptSecret(conn.refreshToken));

    // GSC data lags ~2 days — end the window there instead of "today" to avoid a misleading near-empty final day.
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const start28 = new Date(end);
    start28.setDate(start28.getDate() - 27);

    const [dailyTrend, topQueries, topPages, queryPool] = await Promise.all([
      querySearchAnalytics(accessToken, conn.siteUrl, fmtDate(start28), fmtDate(end), ["date"], 28),
      querySearchAnalytics(accessToken, conn.siteUrl, fmtDate(start28), fmtDate(end), ["query"], 20),
      querySearchAnalytics(accessToken, conn.siteUrl, fmtDate(start28), fmtDate(end), ["page"], 20),
      // Wider pool than the top-20 table, so opportunities are found beyond the head terms.
      querySearchAnalytics(accessToken, conn.siteUrl, fmtDate(start28), fmtDate(end), ["query"], 500),
    ]);

    const totals = dailyTrend.rows.reduce(
      (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
      { clicks: 0, impressions: 0 }
    );
    const avgPosition = dailyTrend.rows.length
      ? dailyTrend.rows.reduce((sum, r) => sum + r.position * r.impressions, 0) / Math.max(1, totals.impressions)
      : 0;
    const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

    return NextResponse.json({
      siteUrl: conn.siteUrl,
      totals: { clicks: totals.clicks, impressions: totals.impressions, avgCtr, avgPosition },
      trend: dailyTrend.rows.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
      topQueries: topQueries.rows.map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position })),
      opportunities: findOpportunities(queryPool.rows.map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position }))),
      topPages: topPages.rows.map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position })),
    });
  } catch (e) {
    console.error("GSC data fetch failed:", e);
    if (e instanceof GscApiUnavailableError) {
      // Not the user's doing and not fixable by reconnecting: say so, and do NOT ask them to reconnect.
      return NextResponse.json({ error: gscMsg(lang, "unavailable"), code: "gsc_api_unavailable" }, { status: 503 });
    }
    if (e instanceof GscReconnectRequiredError) {
      return NextResponse.json(
        { error: gscMsg(lang, "reconnect"), reconnectRequired: true },
        { status: 400 }
      );
    }
    // The raw provider message is logged above; users get a localized one.
    return NextResponse.json({ error: gscMsg(lang, "generic") }, { status: 400 });
  }
}
