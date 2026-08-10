// Thin wrapper around Meta's Instagram API (the newer "Instagram API with
// Instagram Login" product — direct business login against Instagram, NOT
// the older Facebook Login + Pages flow). Requires INSTAGRAM_APP_ID /
// INSTAGRAM_APP_SECRET, which are separate from META_APP_ID/META_APP_SECRET
// (Facebook Login) — get them from the Meta app dashboard under
// "Instagram API" → "API setup with Instagram login". App Review is still
// required for instagram_business_content_publish to work for anyone other
// than accounts added as testers on the app.
import { routedStreamChat } from "@/lib/ai/router";

// This VPS's IP is blocked at the network level by api.instagram.com /
// graph.instagram.com (same issue documented in src/lib/ai/providers.ts for
// Google/Groq/Cohere/OpenRouter) — route through the same relay used there.
const RELAY_BASE_URL = process.env.AI_RELAY_BASE_URL || "";
const IG_API_HOST = RELAY_BASE_URL ? `${RELAY_BASE_URL}/instagram-api` : "https://api.instagram.com";
const IG_OAUTH_HOST = RELAY_BASE_URL ? `${RELAY_BASE_URL}/instagram-graph` : "https://graph.instagram.com";

const GRAPH_VERSION = "v21.0";
const IG_GRAPH_BASE = RELAY_BASE_URL ? `${RELAY_BASE_URL}/instagram-graph/${GRAPH_VERSION}` : `https://graph.instagram.com/${GRAPH_VERSION}`;

export interface GeneratedIgContent {
  caption: string;
  hashtags: string[];
  bestTime: string;
}

/**
 * Same JSON-structured caption/hashtag generation used by the manual
 * "generate" button (/api/social/instagram/generate) — extracted here so
 * the unattended workflow cron (/api/cron/instagram-workflow) can call it
 * without a user session or HTTP round-trip.
 */
export async function generateIgContent(businessName: string, businessType: string, topic: string, lang: "fa" | "en"): Promise<GeneratedIgContent> {
  const systemPrompt = lang === "en"
    ? "You are a professional social media strategist. Return ONLY a raw, valid JSON object — no explanation or markdown."
    : "تو استراتژیست شبکه‌های اجتماعی حرفه‌ای هستی. فقط و فقط یک JSON خام و معتبر برگردان، بدون توضیح یا markdown اضافه.";
  const userMessage = lang === "en"
    ? `Create an engaging, high-engagement Instagram post for the business "${businessName}" (type: ${businessType})${topic ? ` about "${topic}"` : ""}.
Output must match exactly this JSON format:
{"caption": "full caption with fitting emojis", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"], "bestTime": "short description of the best day/time to post for page growth (e.g. Thursday at 8:00 PM)"}
Always include exactly 5 relevant, high-search hashtags.`
    : `برای کسب‌وکار «${businessName}» (نوع: ${businessType})${topic ? ` با موضوع «${topic}»` : ""} یک پست اینستاگرام جذاب و پرتعامل بساز.
خروجی دقیقاً به این فرمت JSON:
{"caption": "کپشن کامل با ایموجی مناسب", "hashtags": ["#تگ1", "#تگ2", "#تگ3", "#تگ4", "#تگ5"], "bestTime": "توضیح کوتاه فارسی از بهترین روز و ساعت انتشار برای رشد پیج (مثلاً پنجشنبه ساعت ۲۰:۰۰)"}
حتماً دقیقاً ۵ هشتگ مرتبط و پرجستجو در ایران بده.`;

  let raw = "";
  await routedStreamChat([{ role: "user", content: userMessage }], systemPrompt, (chunk) => { raw += chunk; }, () => {});

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("پاسخ AI قابل تفسیر نبود");

  const parsed = JSON.parse(match[0]);
  return { caption: parsed.caption, hashtags: (parsed.hashtags || []).slice(0, 5), bestTime: parsed.bestTime || "" };
}

export interface WeeklyCalendarPost {
  dayOffset: number; // 0 = tomorrow, 6 = a week from tomorrow
  caption: string;
  hashtags: string[];
}

/** Structured 7-day content calendar — one caption+hashtags per day, distinct from each other, not just the single-post generator repeated. */
export async function generateWeeklyCalendar(businessName: string, businessType: string, topic: string, lang: "fa" | "en"): Promise<WeeklyCalendarPost[]> {
  const systemPrompt = lang === "en"
    ? "You are a professional social media content strategist. Return ONLY a raw, valid JSON array — no explanation or markdown."
    : "تو استراتژیست محتوای شبکه‌های اجتماعی حرفه‌ای هستی. فقط و فقط یک آرایه JSON خام و معتبر برگردان، بدون توضیح یا markdown اضافه.";
  const userMessage = lang === "en"
    ? `Create a 7-day Instagram content calendar for the business "${businessName}" (type: ${businessType})${topic ? `, focused on "${topic}"` : ""}. Each day must be a genuinely distinct angle/post idea — not repeats of the same caption. Output must match exactly this JSON array format (7 items, dayOffset 0..6):
[{"dayOffset": 0, "caption": "full caption with fitting emojis", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]}, ...]`
    : `یک تقویم محتوایی ۷ روزه برای اینستاگرام کسب‌وکار «${businessName}» (نوع: ${businessType})${topic ? ` با محوریت «${topic}»` : ""} بساز. هر روز باید یک ایده/زاویه واقعاً متفاوت داشته باشد — نه تکرار همان کپشن. خروجی دقیقاً باید این فرمت آرایه JSON باشد (۷ آیتم، dayOffset از ۰ تا ۶):
[{"dayOffset": 0, "caption": "کپشن کامل با ایموجی مناسب", "hashtags": ["#تگ1", "#تگ2", "#تگ3", "#تگ4", "#تگ5"]}, ...]`;

  let raw = "";
  await routedStreamChat([{ role: "user", content: userMessage }], systemPrompt, (chunk) => { raw += chunk; }, () => {}, undefined, undefined, 4096);

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("پاسخ AI قابل تفسیر نبود");

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("پاسخ AI قابل تفسیر نبود");
  return parsed.slice(0, 7).map((p: Record<string, unknown>, i: number) => ({
    dayOffset: typeof p.dayOffset === "number" ? p.dayOffset : i,
    caption: String(p.caption || ""),
    hashtags: Array.isArray(p.hashtags) ? (p.hashtags as string[]).slice(0, 5) : [],
  }));
}

export function getInstagramAppId(): string {
  return process.env.INSTAGRAM_APP_ID || "";
}

/** Direct Instagram Business Login — authorizes against instagram.com, not facebook.com. */
export function getOAuthUrl(redirectUri: string, state: string): string {
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_manage_insights",
  ].join(",");
  const params = new URLSearchParams({
    client_id: getInstagramAppId(),
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

export interface ShortLivedTokenResult {
  token: string;
  igUserId: string;
}

/** Instagram's own token endpoint returns the IG user id directly — no Facebook Pages lookup needed. */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<ShortLivedTokenResult> {
  const form = new URLSearchParams({
    client_id: getInstagramAppId(),
    client_secret: process.env.INSTAGRAM_APP_SECRET || "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${IG_API_HOST}/oauth/access_token`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_message || data.error?.message || "خطا در دریافت توکن از اینستاگرام");
  return { token: data.access_token as string, igUserId: String(data.user_id) };
}

export async function getLongLivedToken(shortLivedToken: string): Promise<{ token: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET || "",
    access_token: shortLivedToken,
  });
  const res = await fetch(`${IG_OAUTH_HOST}/access_token?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_message || data.error?.message || "خطا در تبدیل توکن");
  return { token: data.access_token, expiresIn: data.expires_in };
}

export async function getInstagramUsername(igUserId: string, accessToken: string): Promise<string | undefined> {
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}?fields=username&access_token=${accessToken}`);
  const data = await res.json();
  return data.username;
}

/**
 * Setting up the app-level webhook in the Meta dashboard is NOT enough for
 * "Instagram API with Instagram Login" — each individual connected account
 * must also be subscribed via this per-user Graph API call, or Meta simply
 * never sends it any webhook events (comments, messages, etc.), even though
 * the OAuth connection itself succeeds. Call this right after every
 * successful connect.
 */
export async function subscribeToCommentWebhooks(igUserId: string, accessToken: string): Promise<void> {
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/subscribed_apps?subscribed_fields=comments&access_token=${accessToken}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در فعال‌سازی وبهوک کامنت");
}

/** Two-step publish: create a media container, then publish it. Images must be publicly reachable URLs. */
export async function publishToInstagram(igUserId: string, accessToken: string, imageUrl: string, caption: string): Promise<string> {
  const containerRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok) throw new Error(containerData.error?.message || "خطا در ساخت پست");

  const publishRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishData.error?.message || "خطا در انتشار پست");

  return publishData.id as string;
}

export interface IgAccountStats {
  followersCount: number;
  mediaCount: number;
}

/** Current follower/media count — Instagram exposes no history, so callers that need a trend must snapshot this themselves (see the daily cron). */
export async function getAccountStats(igUserId: string, accessToken: string): Promise<IgAccountStats> {
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}?fields=followers_count,media_count&access_token=${accessToken}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در دریافت آمار پیج");
  return { followersCount: data.followers_count ?? 0, mediaCount: data.media_count ?? 0 };
}

export interface IgMediaItem {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
}

/** Sends a private DM in reply to a specific comment (Instagram's "private_replies" endpoint) — the mechanism behind comment→DM growth campaigns. Only works within a short window after the comment is posted, per Meta's own restriction. */
export async function sendPrivateReply(commentId: string, accessToken: string, message: string): Promise<void> {
  const res = await fetch(`${IG_GRAPH_BASE}/${commentId}/private_replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در ارسال پیام خصوصی");
}

/** Optional public reply left under the comment itself (e.g. "Check your DMs!") — separate call from the private reply. */
export async function replyToComment(commentId: string, accessToken: string, message: string): Promise<void> {
  const res = await fetch(`${IG_GRAPH_BASE}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در پاسخ به کامنت");
}

/** Recent posts with engagement — used for the "content trend" view. */
export async function getRecentMedia(igUserId: string, accessToken: string, limit = 12): Promise<IgMediaItem[]> {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در دریافت پست‌ها");
  return (data.data || []).map((m: Record<string, unknown>) => ({
    id: m.id,
    caption: m.caption ?? null,
    mediaType: m.media_type,
    mediaUrl: m.media_url ?? null,
    thumbnailUrl: m.thumbnail_url ?? null,
    permalink: m.permalink,
    timestamp: m.timestamp,
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
  }));
}
