import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secretBox";
import { getGscAccessToken, listGscSites, querySearchAnalytics, GscApiUnavailableError, GscReconnectRequiredError } from "@/lib/googleSearchConsole";
import { compareRankings, matchProperty, syncWindow, type RankComparison, type RankRow } from "@/lib/seo/rankCore";
import { findOpportunities, type SeoOpportunity } from "@/lib/seo/opportunities";

export type RankSyncResult =
  | { ok: true; date: string; stored: number }
  | { ok: false; reason: "not_connected" | "site_not_in_gsc" | "api_unavailable" | "reconnect_required" | "error" };

const ROW_LIMIT = 250;
/** How many weekly snapshots to keep per site. */
const KEEP_DATES = 12;

/**
 * Pulls this site's real query data from Search Console (7-day window) and stores
 * it as a snapshot. Never estimates anything: if Search Console cannot be reached,
 * or the user does not own the site there, nothing is stored and the reason says why.
 */
export async function syncRankings(siteId: string): Promise<RankSyncResult> {
  const site = await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } });
  const conn = await prisma.gscConnection.findUnique({ where: { userId: site.userId } });
  if (!conn) return { ok: false, reason: "not_connected" };

  try {
    const token = await getGscAccessToken(decryptSecret(conn.refreshToken));
    const property = matchProperty(site.url, await listGscSites(token));
    if (!property) return { ok: false, reason: "site_not_in_gsc" };

    const { start, end } = syncWindow(new Date());
    const data = await querySearchAnalytics(token, property, start, end, ["query"], ROW_LIMIT);
    const rows = data.rows
      .filter((r) => r.keys[0])
      .map((r) => ({ siteId, date: end, query: r.keys[0], clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), ctr: r.ctr * 100, position: r.position }));

    // Re-syncing the same window replaces it instead of piling up duplicates.
    await prisma.$transaction([
      prisma.seoRankSnapshot.deleteMany({ where: { siteId, date: end } }),
      prisma.seoRankSnapshot.createMany({ data: rows }),
    ]);

    const dates = await prisma.seoRankSnapshot.findMany({ where: { siteId }, distinct: ["date"], orderBy: { date: "desc" }, select: { date: true } });
    const stale = dates.slice(KEEP_DATES).map((d) => d.date);
    if (stale.length) await prisma.seoRankSnapshot.deleteMany({ where: { siteId, date: { in: stale } } });

    return { ok: true, date: end, stored: rows.length };
  } catch (e) {
    if (e instanceof GscApiUnavailableError) return { ok: false, reason: "api_unavailable" };
    if (e instanceof GscReconnectRequiredError) return { ok: false, reason: "reconnect_required" };
    console.error("seo rankings sync failed:", e);
    return { ok: false, reason: "error" };
  }
}

const toRow = (r: { query: string; clicks: number; impressions: number; ctr: number; position: number }): RankRow => ({ query: r.query, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });

export interface RankingsView {
  latestDate: string | null;
  previousDate: string | null;
  comparison: RankComparison | null;
  opportunities: SeoOpportunity[];
}

/** Latest snapshot compared with the one before it, plus the growth opportunities found in it. */
export async function getRankings(siteId: string): Promise<RankingsView> {
  const dates = await prisma.seoRankSnapshot.findMany({ where: { siteId }, distinct: ["date"], orderBy: { date: "desc" }, take: 2, select: { date: true } });
  if (!dates.length) return { latestDate: null, previousDate: null, comparison: null, opportunities: [] };

  const [latest, previous] = [dates[0].date, dates[1]?.date ?? null];
  const currRows = (await prisma.seoRankSnapshot.findMany({ where: { siteId, date: latest }, orderBy: { impressions: "desc" } })).map(toRow);
  const prevRows = previous ? (await prisma.seoRankSnapshot.findMany({ where: { siteId, date: previous } })).map(toRow) : [];

  return {
    latestDate: latest,
    previousDate: previous,
    comparison: compareRankings(prevRows, currRows),
    opportunities: findOpportunities(currRows),
  };
}
