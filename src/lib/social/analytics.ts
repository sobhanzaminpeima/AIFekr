import type { IgMediaItem } from "@/lib/instagram";

/**
 * Turns the raw follower snapshots + recent media into the numbers a business
 * owner actually needs: is growth speeding up or stalling, are these real
 * followers, and which content type moves the needle.
 *
 * Everything here is deterministic arithmetic — no AI. The AI growth report
 * then narrates these computed facts instead of eyeballing raw numbers, which
 * is what stops it inventing trends that aren't in the data.
 */

export interface Snapshot {
  date: Date | string;
  followersCount: number;
  mediaCount: number;
}

export interface Bucket {
  /** ISO date of the bucket start. */
  start: string;
  label: string;
  startFollowers: number;
  endFollowers: number;
  delta: number;
}

export type InsightCode =
  | "growth_slowdown"
  | "growth_decline"
  | "low_audience_quality"
  | "reels_outperform_static"
  | "no_posts_in_window"
  | "engagement_collapse"
  | "healthy_growth";

export interface Insight {
  code: InsightCode;
  severity: "info" | "warn" | "critical";
  /** The numbers this was derived from, so the UI (and the AI report) can cite them. */
  facts: Record<string, number | string>;
}

export interface SocialAnalysis {
  dataConfidence: "ok" | "insufficient";
  totalFollowers: number | null;
  /** Whole tracked window. */
  followerDelta: number | null;
  daysTracked: number;
  buckets: { weekly: Bucket[]; monthly: Bucket[] };
  /** % change of the latest window vs the previous equal-length window. */
  growthRatePct: number | null;
  /** (likes+comments+saves+shares) / reach, averaged over posts that report reach. */
  engagementRatePct: number | null;
  /** Average reach as a share of follower count — the "are these followers real" signal. */
  audienceQualityPct: number | null;
  /** Average engagement per post by content type, ranked. */
  correlations: { type: string; posts: number; avgViews: number; avgEngagement: number }[];
  insights: Insight[];
}

const toDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
const round1 = (n: number) => Math.round(n * 10) / 10;

function bucketKey(d: Date, mode: "weekly" | "monthly"): string {
  if (mode === "monthly") return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  // ISO-ish week bucket: snap to the Monday of that week.
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (copy.getUTCDay() + 6) % 7; // Mon=0
  copy.setUTCDate(copy.getUTCDate() - day);
  return copy.toISOString().slice(0, 10);
}

function buildBuckets(snaps: Snapshot[], mode: "weekly" | "monthly"): Bucket[] {
  const groups = new Map<string, Snapshot[]>();
  for (const s of snaps) {
    const k = bucketKey(toDate(s.date), mode);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, items]) => {
      const sorted = items.slice().sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
      const startFollowers = sorted[0].followersCount;
      const endFollowers = sorted[sorted.length - 1].followersCount;
      return { start: key, label: key, startFollowers, endFollowers, delta: endFollowers - startFollowers };
    });
}

function engagementOf(m: IgMediaItem): number {
  return m.likeCount + m.commentsCount + (m.saved ?? 0) + (m.shares ?? 0);
}

export function analyzeSocial(snapshotsRaw: Snapshot[], media: IgMediaItem[], hasMediaError: boolean): SocialAnalysis {
  const snaps = snapshotsRaw
    .slice()
    .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());

  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  const totalFollowers = last?.followersCount ?? null;
  const followerDelta = first && last ? last.followersCount - first.followersCount : null;
  const daysTracked =
    first && last ? Math.max(0, Math.round((toDate(last.date).getTime() - toDate(first.date).getTime()) / 86400000)) : 0;

  const weekly = buildBuckets(snaps, "weekly");
  const monthly = buildBuckets(snaps, "monthly");

  // Growth rate: latest weekly bucket vs the mean of the preceding ones.
  let growthRatePct: number | null = null;
  if (weekly.length >= 2) {
    const latest = weekly[weekly.length - 1].delta;
    const prior = weekly.slice(0, -1);
    const priorAvg = prior.reduce((s, b) => s + b.delta, 0) / prior.length;
    if (priorAvg !== 0) growthRatePct = round1(((latest - priorAvg) / Math.abs(priorAvg)) * 100);
    else if (latest !== 0) growthRatePct = latest > 0 ? 100 : -100;
    else growthRatePct = 0;
  }

  // Engagement + audience quality, only from posts that actually report reach.
  const withReach = media.filter((m) => typeof m.reach === "number" && (m.reach as number) > 0);
  const engagementRatePct = withReach.length
    ? round1((withReach.reduce((s, m) => s + engagementOf(m) / (m.reach as number), 0) / withReach.length) * 100)
    : null;

  const avgReach = withReach.length ? withReach.reduce((s, m) => s + (m.reach as number), 0) / withReach.length : null;
  const audienceQualityPct =
    avgReach !== null && totalFollowers && totalFollowers > 0 ? round1((avgReach / totalFollowers) * 100) : null;

  // Per-type averages — Reels split out from feed video via media_product_type.
  const byType = new Map<string, IgMediaItem[]>();
  for (const m of media) {
    const key = m.mediaProductType === "REELS" ? "REELS" : m.mediaType || "OTHER";
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(m);
  }
  const correlations = Array.from(byType.entries())
    .map(([type, items]) => ({
      type,
      posts: items.length,
      avgViews: Math.round(items.reduce((s, m) => s + (m.views ?? 0), 0) / items.length),
      avgEngagement: Math.round(items.reduce((s, m) => s + engagementOf(m), 0) / items.length),
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // ── Deterministic insights ───────────────────────────────────────────────
  const insights: Insight[] = [];

  if (growthRatePct !== null) {
    if (growthRatePct <= -25) {
      insights.push({
        code: weekly[weekly.length - 1].delta < 0 ? "growth_decline" : "growth_slowdown",
        severity: weekly[weekly.length - 1].delta < 0 ? "critical" : "warn",
        facts: { changePct: growthRatePct, latestWeekDelta: weekly[weekly.length - 1].delta, weeksCompared: weekly.length },
      });
    } else if (growthRatePct >= 25 && weekly[weekly.length - 1].delta > 0) {
      insights.push({ code: "healthy_growth", severity: "info", facts: { changePct: growthRatePct, latestWeekDelta: weekly[weekly.length - 1].delta } });
    }
  }

  // The single most important number for a page like this one: 12k followers
  // but ~0.5% monthly reach means the follower base is inactive or bought.
  if (audienceQualityPct !== null && audienceQualityPct < 5) {
    insights.push({
      code: "low_audience_quality",
      severity: audienceQualityPct < 2 ? "critical" : "warn",
      facts: { audienceQualityPct, avgReach: Math.round(avgReach as number), followers: totalFollowers as number },
    });
  }

  if (engagementRatePct !== null && engagementRatePct < 1 && withReach.length >= 3) {
    insights.push({ code: "engagement_collapse", severity: "warn", facts: { engagementRatePct, postsMeasured: withReach.length } });
  }

  const reels = correlations.find((c) => c.type === "REELS");
  const statics = correlations.filter((c) => c.type !== "REELS");
  if (reels && statics.length) {
    const staticAvg = statics.reduce((s, c) => s + c.avgEngagement, 0) / statics.length;
    if (staticAvg > 0 && reels.avgEngagement >= staticAvg * 1.5) {
      insights.push({
        code: "reels_outperform_static",
        severity: "info",
        facts: { reelsAvgEngagement: reels.avgEngagement, staticAvgEngagement: Math.round(staticAvg), reelsCount: reels.posts },
      });
    }
  }

  if (media.length > 0) {
    const newest = media.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b));
    const daysSincePost = Math.round((Date.now() - new Date(newest.timestamp).getTime()) / 86400000);
    if (daysSincePost >= 14) insights.push({ code: "no_posts_in_window", severity: "warn", facts: { daysSinceLastPost: daysSincePost } });
  }

  return {
    dataConfidence: snaps.length >= 2 && !hasMediaError ? "ok" : "insufficient",
    totalFollowers,
    followerDelta,
    daysTracked,
    buckets: { weekly, monthly },
    growthRatePct,
    engagementRatePct,
    audienceQualityPct,
    correlations,
    insights,
  };
}

/** Compact, human-readable rendering of the analysis for an AI prompt. */
export function analysisToPrompt(a: SocialAnalysis): string {
  const lines: string[] = [];
  lines.push(`Data confidence: ${a.dataConfidence}`);
  if (a.totalFollowers !== null) lines.push(`Followers: ${a.totalFollowers}`);
  if (a.followerDelta !== null) lines.push(`Follower change over ${a.daysTracked} tracked day(s): ${a.followerDelta >= 0 ? "+" : ""}${a.followerDelta}`);
  if (a.growthRatePct !== null) lines.push(`Latest week vs prior average: ${a.growthRatePct >= 0 ? "+" : ""}${a.growthRatePct}%`);
  if (a.engagementRatePct !== null) lines.push(`Engagement rate (of reach): ${a.engagementRatePct}%`);
  if (a.audienceQualityPct !== null) lines.push(`Average reach as share of followers: ${a.audienceQualityPct}%`);
  if (a.buckets.weekly.length) {
    lines.push(`Weekly follower deltas: ${a.buckets.weekly.map((b) => `${b.start}:${b.delta >= 0 ? "+" : ""}${b.delta}`).join(", ")}`);
  }
  if (a.correlations.length) {
    lines.push(`By content type: ${a.correlations.map((c) => `${c.type} (${c.posts} posts, avg ${c.avgViews} views, avg ${c.avgEngagement} engagement)`).join(" | ")}`);
  }
  if (a.insights.length) {
    lines.push(`Computed findings: ${a.insights.map((i) => `${i.code}[${i.severity}] ${JSON.stringify(i.facts)}`).join(" ; ")}`);
  }
  return lines.join("\n");
}
