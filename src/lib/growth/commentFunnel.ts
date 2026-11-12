/**
 * Campaign funnel, top steps (roadmap E9): comments → DMs sent → link clicks
 * for every comment campaign whose link carries a campaign's utm_campaign.
 * The later steps (visits, sign-ups, first value, payments) already come from
 * the growth report, so one row now reads end to end.
 */
type Campaign = { id: string; links: string | null; triggerCount: number };
type LogCount = { campaignId: string | null; status: string; count: number };

export interface CommentFunnel { campaigns: number; comments: number; dmsSent: number; dmsFailed: number; linkClicks: number }

/** The campaign's links that carry exactly this utm_campaign; unreadable links count as none. */
function linksFor(links: string | null, utmCampaign: string): { clicks?: number }[] {
  try {
    const parsed = JSON.parse(links || "[]");
    if (!Array.isArray(parsed)) return [];
    return (parsed as { url?: string; clicks?: number }[]).filter((l) => {
      if (typeof l.url !== "string") return false;
      try { return new URL(l.url, "https://x").searchParams.get("utm_campaign") === utmCampaign; } catch { return false; }
    });
  } catch {
    return [];
  }
}
const clicksFor = (links: string | null, utmCampaign: string) => linksFor(links, utmCampaign).reduce((n, l) => n + (Number.isFinite(l.clicks) ? Number(l.clicks) : 0), 0);
const carries = (links: string | null, utmCampaign: string) => linksFor(links, utmCampaign).length > 0;

export function commentFunnel(utmCampaign: string, campaigns: Campaign[], logs: LogCount[]): CommentFunnel | null {
  const mine = campaigns.filter((c) => carries(c.links, utmCampaign));
  if (!mine.length) return null;
  const ids = new Set(mine.map((c) => c.id));
  const of = (status: string) => logs.filter((l) => l.campaignId && ids.has(l.campaignId) && l.status === status).reduce((n, l) => n + l.count, 0);
  return {
    campaigns: mine.length,
    comments: mine.reduce((n, c) => n + c.triggerCount, 0),
    dmsSent: of("sent"),
    dmsFailed: of("failed"),
    linkClicks: mine.reduce((n, c) => n + clicksFor(c.links, utmCampaign), 0),
  };
}
