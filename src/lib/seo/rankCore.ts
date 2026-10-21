/**
 * Ranking tracking from real Search Console data. Pure helpers: matching a tracked
 * site to a Search Console property, and comparing two snapshots. No network.
 */
export interface RankRow { query: string; clicks: number; impressions: number; ctr: number; position: number }

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** Host of a Search Console property: "https://a.com/", "http://www.a.com/x" or "sc-domain:a.com". */
export function propertyHost(property: string): string | null {
  if (property.startsWith("sc-domain:")) return bareHost(property.slice("sc-domain:".length));
  try { return bareHost(new URL(property).hostname); } catch { return null; }
}

/**
 * Picks the property that covers a tracked site. A URL-prefix property for the
 * exact origin wins over a domain property, which wins over a prefix property
 * for another scheme/subdomain variant of the same host.
 */
export function matchProperty(siteUrl: string, properties: { siteUrl: string; permissionLevel?: string }[]): string | null {
  let host: string;
  let origin: string;
  try { const u = new URL(siteUrl); host = bareHost(u.hostname); origin = u.origin; } catch { return null; }

  const usable = properties.filter((p) => p.permissionLevel !== "siteUnverifiedUser");
  const exact = usable.find((p) => { try { return new URL(p.siteUrl).origin === origin; } catch { return false; } });
  if (exact) return exact.siteUrl;
  const domain = usable.find((p) => p.siteUrl.startsWith("sc-domain:") && propertyHost(p.siteUrl) === host);
  if (domain) return domain.siteUrl;
  const sameHost = usable.find((p) => !p.siteUrl.startsWith("sc-domain:") && propertyHost(p.siteUrl) === host);
  return sameHost ? sameHost.siteUrl : null;
}

export interface RankChange extends RankRow {
  /** Positive = moved UP the results (position number went down). null for a query that was not in the previous snapshot. */
  moved: number | null;
  isNew: boolean;
}

export interface RankComparison {
  rows: RankChange[];
  gained: number;
  lost: number;
  newQueries: number;
  /** Queries that were in the previous snapshot and are gone now. */
  dropped: RankRow[];
}

/** Position moves smaller than this are noise (Search Console positions are averages). */
export const MOVE_THRESHOLD = 0.5;

export function compareRankings(prev: RankRow[], curr: RankRow[]): RankComparison {
  const before = new Map(prev.map((r) => [r.query, r]));
  const now = new Set(curr.map((r) => r.query));
  let gained = 0, lost = 0, newQueries = 0;
  const rows: RankChange[] = curr.map((r) => {
    const p = before.get(r.query);
    if (!p) { newQueries++; return { ...r, moved: null, isNew: true }; }
    const moved = Math.round((p.position - r.position) * 10) / 10;
    if (moved >= MOVE_THRESHOLD) gained++;
    else if (moved <= -MOVE_THRESHOLD) lost++;
    return { ...r, moved, isNew: false };
  });
  return { rows, gained, lost, newQueries, dropped: prev.filter((r) => !now.has(r.query)) };
}

/** yyyy-mm-dd in UTC. */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Search Console data lags about two days; the window ends there so the last day is not a misleading near-empty one. */
export function syncWindow(now: Date, days = 7): { start: string; end: string } {
  const end = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { start: isoDate(start), end: isoDate(end) };
}
