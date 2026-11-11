import { prisma } from "@/lib/db/prisma";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";

/**
 * The AIFekr Live Instagram launch: a comment «لایو» on AIFekr's post gets a
 * DM with a tracked link to /live. The DM itself is sent by the existing
 * Instagram comment automation (src/app/api/webhooks/instagram) of the
 * workspace where AIFekr's Instagram is connected. Nothing here talks to Meta,
 * creates an Instagram campaign or sends anything; it defines the attribution
 * and reports status and the funnel from counts.
 */
export const LIVE_CAMPAIGN = {
  utmCampaign: "instagram_aifekr_live_launch",
  utmSource: "instagram",
  utmMedium: "comment_dm",
  landingPath: "/live",
  targetModule: "live",
  keyword: "لایو",
  name: "AIFekr Live — Instagram launch",
} as const;

export function liveCampaignUrl(origin = publicAppUrl()): string {
  const q = new URLSearchParams({ utm_source: LIVE_CAMPAIGN.utmSource, utm_medium: LIVE_CAMPAIGN.utmMedium, utm_campaign: LIVE_CAMPAIGN.utmCampaign });
  return `${origin}${LIVE_CAMPAIGN.landingPath}?${q}`;
}

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export type LiveActivationBlocker = "record_missing" | "record_not_active" | "instagram_not_connected" | "comment_campaign_missing";

/**
 * The one answer to "is the Live campaign running", read by the campaign table
 * and the campaign card alike. It runs when its record is active and the
 * connected Instagram account has an active «لایو» comment campaign whose link
 * carries the UTM: that comment automation is what sends the DM. The
 * follow-up engine's switch only adds later reminders and never decides this
 * (production 2026-11-09: the table said active while the card said disabled).
 */
export function liveCampaignActivation(recordStatus: string | null | undefined, state: "ready" | "needs_comment_campaign" | "not_connected") {
  const blockers: LiveActivationBlocker[] = [];
  if (!recordStatus) blockers.push("record_missing");
  else if (recordStatus !== "active") blockers.push("record_not_active");
  if (state === "not_connected") blockers.push("instagram_not_connected");
  else if (state === "needs_comment_campaign") blockers.push("comment_campaign_missing");
  return { live: blockers.length === 0, blockers };
}
const keywordMatches = (keyword: string) => keyword.split(/[,،]/).map(k => k.trim().toLowerCase()).includes(LIVE_CAMPAIGN.keyword);

/**
 * Where the campaign stands, from existing rows only: is AIFekr's own Instagram
 * (a connection owned by an admin account) connected, is there an active comment
 * campaign for «لایو» whose link carries our UTM, and does the GrowthCampaign
 * record exist. No token or message text is returned.
 */
export async function liveCampaignStatus() {
  const [growthCampaign, connections] = await Promise.all([
    prisma.growthCampaign.findUnique({ where: { utmCampaign: LIVE_CAMPAIGN.utmCampaign }, select: { id: true, status: true, landingPath: true } }),
    prisma.instagramConnection.findMany({ where: { user: { role: { in: ADMIN_ROLES } } }, select: { id: true, userId: true, businessId: true, igUsername: true, tokenExpiry: true } }),
  ]);
  const owners = [...new Set(connections.map(c => c.userId))];
  const campaigns = owners.length ? await prisma.instagramCommentCampaign.findMany({ where: { userId: { in: owners } }, select: { id: true, name: true, keyword: true, isActive: true, links: true, followGateEnabled: true, triggerCount: true, businessId: true } }) : [];
  const live = campaigns.filter(c => keywordMatches(c.keyword)).map(c => ({
    id: c.id, name: c.name, isActive: c.isActive, followGate: c.followGateEnabled, triggerCount: c.triggerCount,
    linkHasUtm: (c.links ?? "").includes(LIVE_CAMPAIGN.utmCampaign),
    linkClicks: (() => { try { return (JSON.parse(c.links || "[]") as { url?: string; clicks?: number }[]).filter(l => l.url?.includes(LIVE_CAMPAIGN.utmCampaign)).reduce((n, l) => n + (l.clicks ?? 0), 0); } catch { return 0; } })(),
  }));
  const now = Date.now();
  const connected = connections.filter(c => !c.tokenExpiry || c.tokenExpiry.getTime() > now);
  const ready = connected.length > 0 && live.some(c => c.isActive && c.linkHasUtm);
  const state = ready ? "ready" : connected.length ? "needs_comment_campaign" : "not_connected";
  return {
    activation: liveCampaignActivation(growthCampaign?.status, state),
    definition: { ...LIVE_CAMPAIGN, url: liveCampaignUrl() },
    growthCampaign,
    instagram: { connected: connected.length > 0, accounts: connected.map(c => c.igUsername).filter(Boolean), expired: connections.length - connected.length },
    commentCampaigns: live,
    /** "ready" only when a connected account has an active «لایو» campaign whose link carries the UTM. */
    state,
  };
}

/** Admin action: creates the GrowthCampaign record (draft) so touches are grouped under it. Sends nothing. */
export async function ensureLiveGrowthCampaign(actorId: string) {
  const existing = await prisma.growthCampaign.findUnique({ where: { utmCampaign: LIVE_CAMPAIGN.utmCampaign } });
  if (existing) return existing;
  const row = await prisma.growthCampaign.create({ data: { name: LIVE_CAMPAIGN.name, utmCampaign: LIVE_CAMPAIGN.utmCampaign, utmSource: LIVE_CAMPAIGN.utmSource, utmMedium: LIVE_CAMPAIGN.utmMedium, targetModule: LIVE_CAMPAIGN.targetModule, landingPath: LIVE_CAMPAIGN.landingPath, status: "draft", createdById: actorId, notes: `Instagram comment «${LIVE_CAMPAIGN.keyword}» → DM → /live` } });
  await prisma.growthTouch.updateMany({ where: { utmCampaign: row.utmCampaign, campaignId: null }, data: { campaignId: row.id } });
  await prisma.auditLog.create({ data: { actorId, action: "followup_live_campaign_created", targetId: row.id, metadata: JSON.stringify({ utmCampaign: row.utmCampaign }) } });
  return row;
}

const ratio = (a: number, b: number) => b > 0 ? Math.round((a / b) * 1000) / 10 : null;

/**
 * Campaign funnel from counts only: link clicks → visits → visitors → attributed
 * users → new sign-ups → Live started → Live first value → purchase. Live usage
 * is read from LiveVoiceSession / Conversation existence; no transcript is read.
 */
export async function liveCampaignFunnel() {
  const touches = await prisma.growthTouch.findMany({ where: { utmCampaign: LIVE_CAMPAIGN.utmCampaign }, select: { anonId: true, userId: true, createdAt: true }, take: 50_000 });
  const firstTouch = new Map<string, Date>();
  for (const t of touches) if (t.userId && (!firstTouch.has(t.userId) || t.createdAt < firstTouch.get(t.userId)!)) firstTouch.set(t.userId, t.createdAt);
  const userIds = [...firstTouch.keys()];
  const [users, sessions, liveConvs, payments, comments] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, createdAt: true } }),
    prisma.liveVoiceSession.findMany({ where: { userId: { in: userIds } }, select: { userId: true, startedAt: true, seconds: true, chargedMinutes: true } }),
    prisma.conversation.findMany({ where: { userId: { in: userIds }, tool: "live" }, select: { userId: true, createdAt: true } }),
    prisma.payment.findMany({ where: { userId: { in: userIds }, status: "SUCCESS" }, select: { userId: true, amount: true, createdAt: true } }),
    liveCampaignStatus().then(st => st.commentCampaigns.length ? prisma.instagramCommentReplyLog.groupBy({ by: ["status"], _count: { _all: true }, where: { campaignId: { in: st.commentCampaigns.map(c => c.id) } } }) : []),
  ]);
  const after = (u: string, d: Date) => d.getTime() >= (firstTouch.get(u)?.getTime() ?? Infinity) - 60_000;
  const signups = users.filter(u => after(u.id, u.createdAt)).length;
  const started = new Set([...sessions.filter(s => after(s.userId, s.startedAt)).map(s => s.userId), ...liveConvs.filter(c => after(c.userId, c.createdAt)).map(c => c.userId)]);
  const firstValue = new Set(sessions.filter(s => after(s.userId, s.startedAt) && ((s.seconds ?? 0) >= 30 || s.chargedMinutes >= 1)).map(s => s.userId));
  const paid = payments.filter(p => after(p.userId, p.createdAt));
  const buyers = new Set(paid.map(p => p.userId));
  return {
    comments: Object.fromEntries(comments.map(c => [c.status, c._count._all])),
    visits: touches.length, visitors: new Set(touches.map(t => t.anonId)).size,
    attributedUsers: userIds.length, signups, liveStarted: started.size, liveFirstValue: firstValue.size,
    buyers: buyers.size, revenueToman: paid.reduce((n, p) => n + p.amount, 0),
    rates: { signup: ratio(signups, new Set(touches.map(t => t.anonId)).size), liveStart: ratio(started.size, userIds.length), firstValue: ratio(firstValue.size, started.size), purchase: ratio(buyers.size, userIds.length) },
  };
}
