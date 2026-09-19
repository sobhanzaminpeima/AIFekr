/**
 * SEO opportunities derived ONLY from real Search Console rows -- no invented
 * volumes, difficulty scores or traffic forecasts. Each opportunity states
 * the measured numbers it came from, and the rules are deliberately simple so
 * a user can see why a query was flagged.
 */
export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // percent, 0-100
  position: number;
}

export type OpportunityKind = "striking_distance" | "low_ctr";

export interface SeoOpportunity extends GscQueryRow {
  kind: OpportunityKind;
  /** Extra clicks/month-window if the query reached its target -- a range from real impressions, not a promise. */
  potentialExtraClicks: number;
}

/** Typical organic CTR by average position (industry-average curve, used only as a yardstick for "below expected"). */
const EXPECTED_CTR: Record<number, number> = { 1: 28, 2: 15, 3: 10, 4: 7, 5: 5 };

const MIN_IMPRESSIONS_STRIKING = 50;
const MIN_IMPRESSIONS_CTR = 100;

export function findOpportunities(rows: GscQueryRow[], limit = 10): SeoOpportunity[] {
  const out: SeoOpportunity[] = [];
  for (const r of rows) {
    if (!r.query || r.impressions <= 0) continue;

    // Ranking on page 1-2 but not yet in the top 3: the cheapest place to gain clicks.
    if (r.position >= 4 && r.position <= 20 && r.impressions >= MIN_IMPRESSIONS_STRIKING) {
      const targetCtr = EXPECTED_CTR[3];
      out.push({ ...r, kind: "striking_distance", potentialExtraClicks: Math.max(0, Math.round((r.impressions * (targetCtr - r.ctr)) / 100)) });
      continue;
    }

    // Already near the top but clicked far less than that position normally earns: a title/description problem.
    const bucket = Math.round(r.position);
    const expected = EXPECTED_CTR[bucket];
    if (expected !== undefined && r.position <= 5.5 && r.impressions >= MIN_IMPRESSIONS_CTR && r.ctr < expected * 0.6) {
      out.push({ ...r, kind: "low_ctr", potentialExtraClicks: Math.max(0, Math.round((r.impressions * (expected - r.ctr)) / 100)) });
    }
  }
  return out.sort((a, b) => b.potentialExtraClicks - a.potentialExtraClicks).slice(0, limit);
}
