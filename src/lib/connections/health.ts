/**
 * Connection Health Center (E3): one view of every external connection an
 * account depends on, flagged before a campaign silently dies. This is a
 * cheap read of stored state; the per-connection "run check" actions that
 * call the provider live with each connection (Instagram health, GSC data,
 * WordPress test).
 */
export type HealthState = "ok" | "attention" | "broken" | "not_connected";

export interface ConnectionHealth {
  key: "instagram" | "search_console" | "wordpress";
  state: HealthState;
  /** Machine reason; the UI words it per language. */
  reason: "connected" | "token_expired" | "token_expiring" | "no_site_selected" | "not_connected" | "incomplete";
  label: string | null;
  expiresAt: string | null;
  /** Where the owner fixes or checks it. */
  manageAt: string;
}

const DAY = 864e5;

export function instagramHealth(conn: { igUsername: string | null; tokenExpiry: Date | null } | null, now = Date.now()): ConnectionHealth {
  const base = { key: "instagram" as const, manageAt: "/social?tab=connections", label: conn?.igUsername ? "@" + conn.igUsername : null, expiresAt: conn?.tokenExpiry?.toISOString() ?? null };
  if (!conn) return { ...base, state: "not_connected", reason: "not_connected" };
  const left = conn.tokenExpiry ? conn.tokenExpiry.getTime() - now : null;
  if (left != null && left <= 0) return { ...base, state: "broken", reason: "token_expired" };
  if (left != null && left < 7 * DAY) return { ...base, state: "attention", reason: "token_expiring" };
  return { ...base, state: "ok", reason: "connected" };
}

export function searchConsoleHealth(conn: { siteUrl: string | null } | null): ConnectionHealth {
  const base = { key: "search_console" as const, manageAt: "/seo?tab=search-console", label: conn?.siteUrl ?? null, expiresAt: null };
  if (!conn) return { ...base, state: "not_connected", reason: "not_connected" };
  if (!conn.siteUrl) return { ...base, state: "attention", reason: "no_site_selected" };
  return { ...base, state: "ok", reason: "connected" };
}

export function wordpressHealth(conn: { platform: string; siteUrl: string | null; wpUsername: string | null; hasPassword: boolean } | null): ConnectionHealth {
  const base = { key: "wordpress" as const, manageAt: "/seo?tab=wordpress", label: conn?.siteUrl ?? null, expiresAt: null };
  if (!conn || conn.platform !== "wordpress") return { ...base, state: "not_connected", reason: "not_connected" };
  if (!conn.siteUrl || !conn.wpUsername || !conn.hasPassword) return { ...base, state: "attention", reason: "incomplete" };
  return { ...base, state: "ok", reason: "connected" };
}
