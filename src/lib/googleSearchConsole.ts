// Thin wrapper around Google's OAuth2 + Search Console API (webmasters/v3).
// Requires GOOGLE_SEARCH_CONSOLE_CLIENT_ID / GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
// a Google Cloud OAuth client (Web application) with the Search Console API enabled.

const OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SC_BASE = "https://www.googleapis.com/webmasters/v3";

function getClientId(): string {
  return process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || "";
}
function getClientSecret(): string {
  return process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET || "";
}

export function getGscOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${OAUTH_BASE}?${params}`;
}

export async function exchangeGscCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string | null }> {
  const form = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "خطا در دریافت توکن گوگل");
  return { accessToken: data.access_token, refreshToken: data.refresh_token || null };
}

async function parseJsonOrThrow(res: Response, label: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} ${res.status}: non-JSON response (${text.slice(0, 200)})`);
  }
}

export async function getGscAccessToken(refreshToken: string): Promise<string> {
  const form = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await parseJsonOrThrow(res, "token refresh");
  if (!res.ok) throw new Error(data.error_description || data.error || "خطا در تازه‌سازی توکن گوگل");
  return data.access_token;
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const res = await fetch(`${SC_BASE}/sites`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await parseJsonOrThrow(res, "list sites");
  if (!res.ok) throw new Error(data.error?.message || "خطا در دریافت لیست سایت‌ها");
  return (data.siteEntry || []).map((s: { siteUrl: string; permissionLevel: string }) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
}

export interface GscQueryRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalytics {
  rows: GscQueryRow[];
}

export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit = 25
): Promise<GscSearchAnalytics> {
  const res = await fetch(`${SC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
  });
  const data = await parseJsonOrThrow(res, "search analytics query");
  if (!res.ok) throw new Error(data.error?.message || "خطا در دریافت داده‌های Search Console");
  return { rows: data.rows || [] };
}
