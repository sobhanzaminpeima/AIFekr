// Thin wrapper around Meta's Graph API for Instagram content publishing.
// Requires META_APP_ID / META_APP_SECRET from a Meta Developer App with the
// Instagram Graph API product added — see docs/PROJECT_DOCUMENTATION.docx
// for the App Review requirement (instagram_content_publish is an
// Advanced Access permission; without App Review this only works for
// accounts added as testers on the Meta app).
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function getMetaAppId(): string {
  return process.env.META_APP_ID || "";
}

export function getOAuthUrl(redirectUri: string, state: string): string {
  const scopes = ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"].join(",");
  const params = new URLSearchParams({
    client_id: getMetaAppId(),
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: getMetaAppId(),
    client_secret: process.env.META_APP_SECRET || "",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در دریافت توکن از متا");
  return data.access_token as string;
}

export async function getLongLivedToken(shortLivedToken: string): Promise<{ token: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: getMetaAppId(),
    client_secret: process.env.META_APP_SECRET || "",
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "خطا در تبدیل توکن");
  return { token: data.access_token, expiresIn: data.expires_in };
}

export interface IgAccountInfo {
  pageId: string;
  pageAccessToken: string;
  igUserId: string;
  igUsername?: string;
}

/** Walks the user's Facebook Pages to find the first one with a linked Instagram Business account. */
export async function findInstagramBusinessAccount(userAccessToken: string): Promise<IgAccountInfo | null> {
  const pagesRes = await fetch(`${GRAPH_BASE}/me/accounts?access_token=${userAccessToken}`);
  const pagesData = await pagesRes.json();
  if (!pagesRes.ok) throw new Error(pagesData.error?.message || "خطا در دریافت صفحات فیسبوک");

  for (const page of pagesData.data || []) {
    const igRes = await fetch(`${GRAPH_BASE}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
    const igData = await igRes.json();
    if (igData.instagram_business_account?.id) {
      const igUserId = igData.instagram_business_account.id;
      const usernameRes = await fetch(`${GRAPH_BASE}/${igUserId}?fields=username&access_token=${page.access_token}`);
      const usernameData = await usernameRes.json();
      return { pageId: page.id, pageAccessToken: page.access_token, igUserId, igUsername: usernameData.username };
    }
  }
  return null;
}

/** Two-step publish: create a media container, then publish it. Images must be publicly reachable URLs. */
export async function publishToInstagram(igUserId: string, accessToken: string, imageUrl: string, caption: string): Promise<string> {
  const containerRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok) throw new Error(containerData.error?.message || "خطا در ساخت پست");

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishData.error?.message || "خطا در انتشار پست");

  return publishData.id as string;
}
