/**
 * Meta (Facebook/Instagram) Lead Ads connector helpers.
 *
 * Same network reality as src/lib/instagram.ts: this VPS's IP is blocked at
 * the network level by graph.facebook.com, so every Graph call is routed
 * through the shared relay (AI_RELAY_BASE_URL) under a `/facebook-graph`
 * prefix — the relay's nginx must map that prefix to
 * https://graph.facebook.com. Until the relay is up, the OAuth callback and
 * lead fetch below will fail (caught and surfaced as LeadSource.status
 * "error"); the inbound webhook itself still arrives regardless.
 *
 * The OAuth *dialog* is a browser redirect to www.facebook.com and needs no
 * relay — only the server-to-server token exchange and Graph reads do.
 */
const RELAY_BASE_URL = process.env.AI_RELAY_BASE_URL || "";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = RELAY_BASE_URL
  ? `${RELAY_BASE_URL}/facebook-graph/${GRAPH_VERSION}`
  : `https://graph.facebook.com/${GRAPH_VERSION}`;

const APP_ID = process.env.META_APP_ID || "";
const APP_SECRET = process.env.META_APP_SECRET || "";

export function metaConfigured(): boolean {
  return !!APP_ID && !!APP_SECRET;
}

export const META_LEAD_SCOPES = [
  "leads_retrieval",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
].join(",");

/** Browser-facing dialog URL — hits www.facebook.com directly, no relay. */
export function metaOAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    state,
    scope: META_LEAD_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${p}`;
}

async function graphJson(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH_BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string } }).error;
    throw new Error(err?.message || `Graph error ${res.status}`);
  }
  return data as Record<string, unknown>;
}

export async function metaExchangeCode(code: string, redirectUri: string): Promise<string> {
  const p = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: redirectUri, code });
  const data = await graphJson(`/oauth/access_token?${p}`);
  return String(data.access_token);
}

export async function metaLongLivedUserToken(shortToken: string): Promise<{ token: string; expiresIn: number }> {
  const p = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: shortToken,
  });
  const data = await graphJson(`/oauth/access_token?${p}`);
  return { token: String(data.access_token), expiresIn: Number(data.expires_in || 5_184_000) };
}

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
}

/** Pages the user manages, each with its own (long-lived, when the user token is) Page token. */
export async function metaListPages(userToken: string): Promise<MetaPage[]> {
  const data = await graphJson(`/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`);
  const rows = (data.data as Array<{ id: string; name: string; access_token: string }>) || [];
  return rows.map((r) => ({ id: r.id, name: r.name, accessToken: r.access_token }));
}

/** Subscribe our app to the Page's `leadgen` webhook field. Idempotent. */
export async function metaSubscribePageLeadgen(pageId: string, pageToken: string): Promise<void> {
  await graphJson(`/${pageId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ subscribed_fields: "leadgen", access_token: pageToken }),
  });
}

export async function metaUnsubscribePageLeadgen(pageId: string, pageToken: string): Promise<void> {
  await graphJson(`/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`, { method: "DELETE" }).catch(() => {});
}

export interface MetaLeadFieldDatum {
  name: string;
  values: string[];
}

/** Fetch one lead's full field_data by its leadgen_id (from the webhook payload). */
export async function metaFetchLead(leadgenId: string, pageToken: string): Promise<{ fieldData: MetaLeadFieldDatum[]; campaignName?: string; adId?: string; createdTime?: string }> {
  const data = await graphJson(`/${leadgenId}?fields=field_data,campaign_name,ad_id,created_time&access_token=${encodeURIComponent(pageToken)}`);
  return {
    fieldData: (data.field_data as MetaLeadFieldDatum[]) || [],
    campaignName: data.campaign_name as string | undefined,
    adId: data.ad_id as string | undefined,
    createdTime: data.created_time as string | undefined,
  };
}

/** Map Meta's free-form field_data onto our fixed contact fields. */
export function mapMetaFields(fieldData: MetaLeadFieldDatum[]): {
  name?: string; phone?: string; email?: string; company?: string; message?: string;
} {
  const get = (...keys: string[]) => {
    for (const fd of fieldData) {
      const n = fd.name.toLowerCase();
      if (keys.some((k) => n === k || n.includes(k))) return fd.values?.[0];
    }
    return undefined;
  };
  const first = get("first_name", "first name");
  const last = get("last_name", "last name");
  const full = get("full_name", "full name", "name");
  return {
    name: full || [first, last].filter(Boolean).join(" ") || undefined,
    phone: get("phone_number", "phone", "mobile", "tel"),
    email: get("email"),
    company: get("company_name", "company", "organization"),
    message: get("message", "comments", "note", "question"),
  };
}
