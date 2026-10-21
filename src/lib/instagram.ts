// Thin wrapper around Meta's Instagram API (the newer "Instagram API with
// Instagram Login" product — direct business login against Instagram, NOT
// the older Facebook Login + Pages flow). Requires INSTAGRAM_APP_ID /
// INSTAGRAM_APP_SECRET, which are separate from META_APP_ID/META_APP_SECRET
// (Facebook Login) — get them from the Meta app dashboard under
// "Instagram API" → "API setup with Instagram login". App Review is still
// required for instagram_business_content_publish to work for anyone other
// than accounts added as testers on the app.
import { routedStreamChat } from "@/lib/ai/router";
import { isCustomProviderModel, streamCustomProvider } from "@/lib/ai/customProviders";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";

/**
 * Content-generation language. This used to be `"fa" | "en"`, which meant a
 * German user's Instagram captions came back in Persian — the caller
 * coerced anything that wasn't "en" to "fa". German is a first-class UI
 * language, so it has to be representable here too.
 */
export type PromptLang = Lang;

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
export async function generateIgContent(businessName: string, businessType: string, topic: string, lang: PromptLang, model?: string, brandContext = ""): Promise<GeneratedIgContent> {
  const systemPrompt = tri(lang,
    "تو استراتژیست شبکه‌های اجتماعی حرفه‌ای هستی. فقط و فقط یک JSON خام و معتبر برگردان، بدون توضیح یا markdown اضافه.",
    "You are a professional social media strategist. Return ONLY a raw, valid JSON object — no explanation or markdown.",
    "Du bist ein professioneller Social-Media-Stratege. Gib AUSSCHLIESSLICH ein rohes, gültiges JSON-Objekt zurück — keine Erklärung, kein Markdown. Schreibe alle Inhalte auf Deutsch.");
  const userMessage = lang === "de"
    ? `Erstelle einen ansprechenden, reichweitenstarken Instagram-Beitrag für das Unternehmen „${businessName}" (Branche: ${businessType})${topic ? ` zum Thema „${topic}"` : ""}.
Die Ausgabe muss exakt diesem JSON-Format entsprechen:
{"caption": "vollständige Bildunterschrift auf Deutsch mit passenden Emojis", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"], "bestTime": "kurze Angabe zum besten Tag und zur besten Uhrzeit für die Veröffentlichung (z. B. Donnerstag um 20:00 Uhr)"}
Gib immer genau 5 relevante, häufig gesuchte Hashtags an.`
    : lang === "en"
    ? `Create an engaging, high-engagement Instagram post for the business "${businessName}" (type: ${businessType})${topic ? ` about "${topic}"` : ""}.
Output must match exactly this JSON format:
{"caption": "full caption with fitting emojis", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"], "bestTime": "short description of the best day/time to post for page growth (e.g. Thursday at 8:00 PM)"}
Always include exactly 5 relevant, high-search hashtags.`
    : `برای کسب‌وکار «${businessName}» (نوع: ${businessType})${topic ? ` با موضوع «${topic}»` : ""} یک پست اینستاگرام جذاب و پرتعامل بساز.
خروجی دقیقاً به این فرمت JSON:
{"caption": "کپشن کامل با ایموجی مناسب", "hashtags": ["#تگ1", "#تگ2", "#تگ3", "#تگ4", "#تگ5"], "bestTime": "توضیح کوتاه فارسی از بهترین روز و ساعت انتشار برای رشد پیج (مثلاً پنجشنبه ساعت ۲۰:۰۰)"}
حتماً دقیقاً ۵ هشتگ مرتبط و پرجستجو در ایران بده.`;

  // The tenant's saved positioning (brandProfileToPrompt) is appended to the
  // task, not the system prompt, so it reads as context about THIS account
  // rather than instructions that could override the output format.
  const fullMessage = userMessage + brandContext;

  let raw = "";
  if (isCustomProviderModel(model)) {
    await streamCustomProvider(model, [{ role: "user", content: fullMessage }], systemPrompt, (chunk) => { raw += chunk; });
  } else {
    await routedStreamChat([{ role: "user", content: fullMessage }], systemPrompt, (chunk) => { raw += chunk; }, () => {}, model);
  }

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
export async function generateWeeklyCalendar(businessName: string, businessType: string, topic: string, lang: PromptLang, brandContext = ""): Promise<WeeklyCalendarPost[]> {
  const systemPrompt = tri(lang,
    "تو استراتژیست محتوای شبکه‌های اجتماعی حرفه‌ای هستی. فقط و فقط یک آرایه JSON خام و معتبر برگردان، بدون توضیح یا markdown اضافه.",
    "You are a professional social media content strategist. Return ONLY a raw, valid JSON array — no explanation or markdown.",
    "Du bist ein professioneller Social-Media-Content-Stratege. Gib AUSSCHLIESSLICH ein rohes, gültiges JSON-Array zurück — keine Erklärung, kein Markdown. Schreibe alle Inhalte auf Deutsch.");
  const userMessage = lang === "de"
    ? `Erstelle einen 7-Tage-Instagram-Content-Kalender für das Unternehmen „${businessName}" (Branche: ${businessType})${topic ? `, mit Schwerpunkt auf „${topic}"` : ""}. Jeder Tag muss einen wirklich eigenständigen Blickwinkel bzw. eine eigene Beitragsidee haben — keine Wiederholung derselben Bildunterschrift. Die Ausgabe muss exakt diesem JSON-Array-Format entsprechen (7 Einträge, dayOffset 0..6):
[{"dayOffset": 0, "caption": "vollständige Bildunterschrift auf Deutsch mit passenden Emojis", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]}, ...]`
    : lang === "en"
    ? `Create a 7-day Instagram content calendar for the business "${businessName}" (type: ${businessType})${topic ? `, focused on "${topic}"` : ""}. Each day must be a genuinely distinct angle/post idea — not repeats of the same caption. Output must match exactly this JSON array format (7 items, dayOffset 0..6):
[{"dayOffset": 0, "caption": "full caption with fitting emojis", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]}, ...]`
    : `یک تقویم محتوایی ۷ روزه برای اینستاگرام کسب‌وکار «${businessName}» (نوع: ${businessType})${topic ? ` با محوریت «${topic}»` : ""} بساز. هر روز باید یک ایده/زاویه واقعاً متفاوت داشته باشد — نه تکرار همان کپشن. خروجی دقیقاً باید این فرمت آرایه JSON باشد (۷ آیتم، dayOffset از ۰ تا ۶):
[{"dayOffset": 0, "caption": "کپشن کامل با ایموجی مناسب", "hashtags": ["#تگ1", "#تگ2", "#تگ3", "#تگ4", "#تگ5"]}, ...]`;

  let raw = "";
  await routedStreamChat([{ role: "user", content: userMessage + brandContext }], systemPrompt, (chunk) => { raw += chunk; }, () => {}, undefined, undefined, 4096);

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
 * The `user_id` from the OAuth token-exchange response is an Instagram-scoped
 * id that the Graph API's `/{id}` node and — critically — the comments/messages
 * webhook's `entry.id` do NOT use. Both of those use the IG User ID, which is
 * what `GET /me?fields=user_id` returns. Storing the wrong one meant every
 * inbound webhook failed its `instagramConnection` lookup, so comment→DM
 * automations silently never fired. Always resolve the real id here right
 * after connecting.
 */
export async function getInstagramProfile(accessToken: string): Promise<{ userId: string; username?: string; accountType?: string }> {
  const res = await fetch(`${IG_GRAPH_BASE}/me?fields=user_id,username,account_type&access_token=${accessToken}`);
  const data = await res.json();
  if (!res.ok || !data.user_id) {
    throw new Error(data.error?.message || "خطا در دریافت پروفایل اینستاگرام");
  }
  return { userId: String(data.user_id), username: data.username, accountType: data.account_type };
}

/**
 * Setting up the app-level webhook in the Meta dashboard is NOT enough for
 * "Instagram API with Instagram Login" — each individual connected account
 * must also be subscribed via this per-user Graph API call, or Meta simply
 * never sends it any webhook events (comments, messages, etc.), even though
 * the OAuth connection itself succeeds. Call this right after every
 * successful connect.
 */
export async function subscribeToInstagramWebhooks(igUserId: string, accessToken: string): Promise<void> {
  // messages powers Auto Direct; comments powers comment campaigns; messaging_postbacks
  // delivers button taps for the Follow Gate.
  const fields = "comments,messages,messaging_postbacks";
  const body = new URLSearchParams({ subscribed_fields: fields, access_token: accessToken });
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Meta webhook subscription failed (HTTP ${res.status})`);
  // Meta may respond HTTP 200 while the subscription itself was rejected.
  // Treat only its explicit success response as enabled; otherwise the UI
  // would claim success while no webhook events can arrive.
  if (data.success !== true) {
    throw new Error(data.error?.message || "Meta درخواست اشتراک وبهوک را تأیید نکرد؛ تنظیمات Webhooks اپ Meta را بررسی کنید.");
  }
}

/** Read back the account-level fields so the dashboard can distinguish an
 * actual subscription from a stale connection or a failed Meta request. */
export async function getInstagramWebhookSubscription(igUserId: string, accessToken: string): Promise<{ subscribed: boolean; fields: string[] }> {
  const configuredAppId = getInstagramAppId();
  if (!configuredAppId) throw new Error("INSTAGRAM_APP_ID server configuration is missing");
  const params = new URLSearchParams({ access_token: accessToken });
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/subscribed_apps?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Meta webhook status failed (HTTP ${res.status})`);

  const subscriptions = Array.isArray(data.data) ? data.data : [];
  const appSubscription = subscriptions.find((item: { application?: { id?: string }; subscribed_fields?: string[] }) => item.application?.id === configuredAppId);
  const fields = Array.isArray(appSubscription?.subscribed_fields) ? appSubscription.subscribed_fields : [];
  return { subscribed: ["comments", "messages", "messaging_postbacks"].every((field) => fields.includes(field)), fields };
}

/** Reverse of subscribeToInstagramWebhooks — called on disconnect so Meta stops
 * delivering this account's events to us. Best-effort; caller swallows errors. */
export async function unsubscribeFromWebhooks(igUserId: string, accessToken: string): Promise<void> {
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/subscribed_apps?access_token=${accessToken}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "خطا در لغو وبهوک");
  }
}

/** Plain text DM to an existing conversation (not a private-reply-to-comment — uses the account's own messages endpoint). */
export async function sendTextMessage(igUserId: string, recipientId: string, accessToken: string, text: string): Promise<void> {
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در ارسال پیام");
}

/** Best-effort Instagram sender action. A failed indicator must never block the actual reply. */
export async function sendTypingIndicator(
  igUserId: string,
  recipientId: string,
  accessToken: string,
  action: "typing_on" | "typing_off",
): Promise<void> {
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, sender_action: action, access_token: accessToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "Instagram typing indicator failed");
  }
}

/** DM with a single postback button — the mechanism behind the Follow Gate's "I followed" confirmation. */
export async function sendButtonMessage(igUserId: string, recipientId: string, accessToken: string, text: string, buttonTitle: string, payload: string): Promise<void> {
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: { template_type: "button", text, buttons: [{ type: "postback", title: buttonTitle, payload }] },
        },
      },
      access_token: accessToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در ارسال پیام دکمه‌دار");
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

/**
 * Reel (video) publish — same two-step container/publish flow as
 * publishToInstagram, but the container needs an extra step: Instagram
 * processes the uploaded video asynchronously, so media_publish must wait
 * until the container's status_code flips to FINISHED (ERROR fails fast).
 * Polls every 5s for up to 2 minutes — videos from /api/video/generate are
 * short (5-30s) so this is generous, not a hard technical ceiling.
 */
export async function publishReelToInstagram(igUserId: string, accessToken: string, videoUrl: string, caption: string): Promise<string> {
  const containerRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", video_url: videoUrl, caption, access_token: accessToken }),
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok) throw new Error(containerData.error?.message || "خطا در ساخت ریل");
  const containerId = containerData.id as string;

  const maxAttempts = 24; // 24 * 5s = 2 minutes
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusRes = await fetch(`${IG_GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`);
    const statusData = await statusRes.json();
    if (!statusRes.ok) throw new Error(statusData.error?.message || "خطا در بررسی وضعیت پردازش ریل");

    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR") throw new Error("پردازش ویدیو توسط اینستاگرام با خطا مواجه شد");
    if (attempt === maxAttempts - 1) throw new Error("پردازش ویدیو توسط اینستاگرام بیش از حد طول کشید");

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const publishRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishData.error?.message || "خطا در انتشار ریل");

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
  /** IMAGE | VIDEO | CAROUSEL_ALBUM */
  mediaType: string;
  /** FEED | REELS | STORY | AD — the field that actually tells a Reel apart from a feed video. */
  mediaProductType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  /** From media insights — null when the account/media type doesn't expose it. */
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
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

interface IgInsightNode { data?: { name: string; values?: { value: number }[] }[] }

function readInsight(insights: IgInsightNode | undefined, name: string): number | null {
  const row = insights?.data?.find((d) => d.name === name);
  const v = row?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
}

/**
 * Recent posts with engagement + per-media insights (reach / views / saves /
 * shares), and media_product_type so Reels are distinguishable from feed
 * posts. Insights are pulled in the same call via field expansion; a media
 * type that doesn't support a metric just omits it (we surface null, not 0).
 */
export async function getRecentMedia(igUserId: string, accessToken: string, limit = 12): Promise<IgMediaItem[]> {
  const fields =
    "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count," +
    "insights.metric(reach,saved,shares,views)";
  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${accessToken}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در دریافت پست‌ها");
  return (data.data || []).map((m: Record<string, unknown>) => {
    const insights = m.insights as IgInsightNode | undefined;
    return {
      id: m.id,
      caption: m.caption ?? null,
      mediaType: m.media_type,
      mediaProductType: (m.media_product_type as string) ?? null,
      mediaUrl: m.media_url ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      permalink: m.permalink,
      timestamp: m.timestamp,
      likeCount: m.like_count ?? 0,
      commentsCount: m.comments_count ?? 0,
      views: readInsight(insights, "views"),
      reach: readInsight(insights, "reach"),
      saved: readInsight(insights, "saved"),
      shares: readInsight(insights, "shares"),
    };
  });
}

export interface IgMediaBreakdownRow {
  type: string; // "REELS" | "IMAGE" | "CAROUSEL_ALBUM" | "VIDEO"
  count: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  totalReach: number;
  avgLikes: number;
  avgComments: number;
  avgViews: number;
}

/** Aggregates getRecentMedia() by content type for the analytics breakdown. */
export function summarizeMediaByType(media: IgMediaItem[]): IgMediaBreakdownRow[] {
  const groups = new Map<string, IgMediaItem[]>();
  for (const m of media) {
    const key = m.mediaProductType === "REELS" ? "REELS" : m.mediaType || "OTHER";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return Array.from(groups.entries())
    .map(([type, items]) => {
      const totalLikes = items.reduce((s, m) => s + m.likeCount, 0);
      const totalComments = items.reduce((s, m) => s + m.commentsCount, 0);
      const totalViews = items.reduce((s, m) => s + (m.views ?? 0), 0);
      const totalReach = items.reduce((s, m) => s + (m.reach ?? 0), 0);
      const n = items.length || 1;
      return {
        type,
        count: items.length,
        totalLikes,
        totalComments,
        totalViews,
        totalReach,
        avgLikes: Math.round(totalLikes / n),
        avgComments: Math.round(totalComments / n),
        avgViews: Math.round(totalViews / n),
      };
    })
    .sort((a, b) => b.count - a.count);
}
