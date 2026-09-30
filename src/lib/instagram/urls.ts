const PRODUCTION_APP_URL = "https://aifekr.com";
const LOCAL_APP_URL = "http://localhost:3003";

/**
 * Resolve a canonical public app URL for Instagram OAuth. NEXT_PUBLIC_ values
 * are embedded at build time, so refuse a localhost callback in production
 * even when a local .env.local accidentally leaks into the build environment.
 */
export function resolveInstagramAppUrl(configuredUrl: string | undefined, isProduction: boolean): string {
  const fallback = isProduction ? PRODUCTION_APP_URL : LOCAL_APP_URL;
  const candidate = configuredUrl?.trim().replace(/\/+$/, "");
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);
    if (isProduction && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return fallback;
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function getInstagramRedirectUri(): string {
  const appUrl = resolveInstagramAppUrl(process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV === "production");
  return `${appUrl}/api/social/instagram/callback`;
}
