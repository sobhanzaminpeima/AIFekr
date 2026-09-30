import { prisma } from "@/lib/db/prisma";

/**
 * Competitor / comparable-page benchmarking via Meta's official
 * `business_discovery` edge.
 *
 * Scraping Instagram is on this project's "never build" list, and Meta gives
 * no other way to read another account's posts — `business_discovery` is the
 * sanctioned one. It returns, for any PUBLIC Business/Creator account:
 * follower count, media count, and recent media (caption, like_count,
 * comments_count, media_product_type, timestamp, permalink). No private data,
 * no insights for accounts we don't own.
 *
 * Two things about how it is called here, both verified against production:
 *  - It does NOT exist on the "Instagram API with Instagram Login" flow the
 *    tenant connections use (`Tried accessing nonexisting field`). It only
 *    works on the Page-linked Instagram Graph path, so calls go through the
 *    relay's `/facebook-graph` prefix with a Page token.
 *  - The caller node is OUR OWN IG Business account, not the tenant's. Meta
 *    lets any app-authorised business account look up any public business
 *    account, so one configured caller serves every tenant.
 *
 * Gated on App Review: until `instagram_basic` has Advanced Access, every
 * cross-account read returns `(#10) Application does not have permission`.
 * `competitorsEnabled()` keeps the feature dark until then rather than
 * shipping a button that always errors.
 */
const RELAY = process.env.AI_RELAY_BASE_URL || "";
const GRAPH = RELAY ? `${RELAY}/facebook-graph/v21.0` : "https://graph.facebook.com/v21.0";

export function competitorsEnabled(): boolean {
  return process.env.SOCIAL_COMPETITORS_ENABLED === "1";
}

export const MAX_COMPETITORS_PER_TENANT = 5;

async function discoveryCaller(): Promise<{ igUserId: string; token: string } | null> {
  const envId = process.env.META_DISCOVERY_IG_USER_ID;
  const envToken = process.env.META_DISCOVERY_PAGE_TOKEN;
  if (envId && envToken) return { igUserId: envId, token: envToken };

  // Fall back to the Page connection the Lead Ads module already stores —
  // same app, same Page, already long-lived.
  const src = await prisma.leadSource.findFirst({
    where: { provider: "meta", status: "active", accessToken: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!src?.accessToken) return null;

  const res = await fetch(`${GRAPH}/${src.externalId}?fields=instagram_business_account&access_token=${encodeURIComponent(src.accessToken)}`);
  const data = await res.json().catch(() => ({}));
  const igb = data?.instagram_business_account?.id;
  if (!igb) return null;
  return { igUserId: String(igb), token: src.accessToken };
}

export interface CompetitorPost {
  caption: string | null;
  likeCount: number;
  commentsCount: number;
  mediaProductType: string | null;
  mediaType: string | null;
  timestamp: string;
  permalink: string | null;
  thumbnailUrl: string | null;
}

export interface CompetitorData {
  username: string;
  followersCount: number;
  mediaCount: number;
  posts: CompetitorPost[];
}

export class CompetitorLookupError extends Error {
  constructor(message: string, readonly needsAppReview = false) {
    super(message);
  }
}

/** Reads one public business/creator account. Throws CompetitorLookupError on any Meta refusal. */
export async function discoverCompetitor(username: string, postLimit = 12): Promise<CompetitorData> {
  const handle = username.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) throw new CompetitorLookupError("نام کاربری نامعتبر است");

  const caller = await discoveryCaller();
  if (!caller) throw new CompetitorLookupError("حساب مرجع برای تحلیل رقبا تنظیم نشده است");

  const fields =
    `business_discovery.username(${handle}){followers_count,media_count,` +
    `media.limit(${postLimit}){caption,like_count,comments_count,media_product_type,media_type,timestamp,permalink,thumbnail_url,media_url}}`;

  const res = await fetch(`${GRAPH}/${caller.igUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(caller.token)}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    const msg: string = data?.error?.message || `Graph ${res.status}`;
    const code = data?.error?.code;
    // #10 is Meta's "your app lacks the permission for this action" — i.e.
    // instagram_basic is still on Standard Access, not a fault in this code.
    if (code === 10) throw new CompetitorLookupError("این قابلیت تا تأیید App Review متا فعال نمی‌شود", true);
    // #110 / "does not exist" covers private, personal, or misspelled accounts.
    throw new CompetitorLookupError(msg);
  }

  const bd = data.business_discovery;
  if (!bd) throw new CompetitorLookupError("این اکانت عمومی/بیزنسی نیست یا یافت نشد");

  const posts: CompetitorPost[] = ((bd.media?.data as Record<string, unknown>[]) || []).map((m) => ({
    caption: (m.caption as string) ?? null,
    likeCount: (m.like_count as number) ?? 0,
    commentsCount: (m.comments_count as number) ?? 0,
    mediaProductType: (m.media_product_type as string) ?? null,
    mediaType: (m.media_type as string) ?? null,
    timestamp: (m.timestamp as string) ?? "",
    permalink: (m.permalink as string) ?? null,
    thumbnailUrl: ((m.thumbnail_url as string) || (m.media_url as string)) ?? null,
  }));

  return {
    username: handle,
    followersCount: bd.followers_count ?? 0,
    mediaCount: bd.media_count ?? 0,
    posts,
  };
}

/** Engagement per post, used to rank which of a competitor's posts actually worked. */
export function rankPosts(posts: CompetitorPost[], take = 5): CompetitorPost[] {
  return posts
    .slice()
    .sort((a, b) => b.likeCount + b.commentsCount - (a.likeCount + a.commentsCount))
    .slice(0, take);
}

/** Renders a competitor set for an AI prompt — captions truncated, metrics kept. */
export function competitorsToPrompt(sets: { username: string; followersCount: number; posts: CompetitorPost[] }[]): string {
  if (!sets.length) return "";
  const blocks = sets.map((s) => {
    const top = rankPosts(s.posts, 5)
      .map((p, i) => {
        const kind = p.mediaProductType === "REELS" ? "REEL" : p.mediaType || "POST";
        return `  ${i + 1}. [${kind}] ${(p.caption || "").slice(0, 160).replace(/\n/g, " ")} — ${p.likeCount} likes, ${p.commentsCount} comments (${(p.timestamp || "").slice(0, 10)})`;
      })
      .join("\n");
    return `@${s.username} — ${s.followersCount} followers\n${top || "  (no posts returned)"}`;
  });
  return `\n\nComparable public accounts and their highest-engagement recent posts:\n${blocks.join("\n\n")}`;
}
