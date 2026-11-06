import { GROWTH_MODULES } from "./modules";

export const ANON_COOKIE = "afk_aid";

export type TouchInput = {
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; utmTerm?: string;
  referrerHost?: string; landingPath: string; targetModule?: string;
};
export type Confidence = "utm" | "referrer" | "direct" | "unknown";

const clean = (value: string | null | undefined, max = 120) => {
  const v = (value || "").trim().toLowerCase().replace(/[^\p{L}\p{N}._\-+ ]/gu, "").slice(0, max);
  return v || undefined;
};

/**
 * Builds an attribution touch from the landing URL and document.referrer.
 * Only UTM values and the referrer's host are kept -- no full referrer URL,
 * no query string, no IP. Same-site referrers are not a source.
 */
export function parseTouch(landingUrl: string, referrer: string | null | undefined, ownHosts: string[]): { touch: TouchInput; confidence: Confidence } | null {
  let url: URL;
  try { url = new URL(landingUrl, "https://aifekr.com"); } catch { return null; }
  const p = url.searchParams;
  const touch: TouchInput = {
    utmSource: clean(p.get("utm_source")), utmMedium: clean(p.get("utm_medium")), utmCampaign: clean(p.get("utm_campaign")),
    utmContent: clean(p.get("utm_content")), utmTerm: clean(p.get("utm_term")),
    landingPath: url.pathname.slice(0, 200),
    targetModule: moduleForPath(url.pathname) ?? undefined,
  };
  let host: string | undefined;
  try { host = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, "") : undefined; } catch { host = undefined; }
  if (host && !ownHosts.some(h => host === h || host.endsWith("." + h))) touch.referrerHost = host.slice(0, 120);
  // No UTM but a social referrer: the source is inferred (utm_medium "social"); real UTM values are never overwritten.
  const realUtm = !!(touch.utmSource || touch.utmCampaign);
  if (!realUtm && touch.referrerHost) {
    const inferred = inferredSocialSource(touch.referrerHost);
    if (inferred) { touch.utmSource = inferred; touch.utmMedium = touch.utmMedium ?? "social"; }
  }
  if (realUtm) return { touch, confidence: "utm" };
  if (touch.referrerHost) return { touch, confidence: "referrer" };
  return null; // a direct visit is not stored as a touch
}

/** instagram.com / l.instagram.com → "instagram"; facebook.com / m.facebook.com / l.facebook.com / lm.facebook.com → "facebook". */
export function inferredSocialSource(host: string): "instagram" | "facebook" | null {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram";
  if (h === "facebook.com" || h.endsWith(".facebook.com") || h === "fb.com") return "facebook";
  return null;
}

/** "utm" for real campaign values; an inferred social source (no campaign, medium "social", matching referrer) stays "referrer". */
export function touchConfidence(t: { utmCampaign?: string | null; utmSource?: string | null; utmMedium?: string | null; referrerHost?: string | null }): "utm" | "referrer" | null {
  if (t.utmCampaign) return "utm";
  if (t.utmSource) return t.referrerHost && t.utmMedium === "social" && inferredSocialSource(t.referrerHost) === t.utmSource ? "referrer" : "utm";
  return t.referrerHost ? "referrer" : null;
}

/** Attribution key of a touch for reports: campaign, else source (real or inferred), else referrer host. */
export const touchKey = (t: { utmCampaign: string | null; utmSource: string | null; referrerHost: string | null } | null | undefined) =>
  t?.utmCampaign ?? (t?.utmSource ? `src:${t.utmSource}` : t?.referrerHost ? `ref:${t.referrerHost}` : "unknown");

/** Paths a sign-in/sign-up may return to. Relative, same-site, and inside the product. */
const RETURN_PREFIXES = ["/voice-studio", "/live", "/complete-phone", "/live", "/chat", "/image", "/video", "/video-factory", "/music", "/crm", "/seo", "/social", "/website-designer", "/student", "/fitness", "/fit", "/home", "/plans", "/credits", "/checkout", "/settings", "/start", "/play", "/explore", "/choose-plan", "/lead-gen", "/agents", "/startup", "/accounting", "/voice-agent", "/admin"];

export function safeInternalPath(target: string | null | undefined): string | null {
  if (!target || target.length > 500) return null;
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\") || /[\u0000-\u001f]/.test(target)) return null;
  let url: URL;
  try { url = new URL(target, "https://aifekr.invalid"); } catch { return null; }
  if (url.host !== "aifekr.invalid") return null;
  const path = url.pathname;
  if (!RETURN_PREFIXES.some(p => path === p || path.startsWith(p + "/"))) return null;
  return path + url.search;
}

export function moduleForPath(pathname: string): string | null {
  const path = pathname.replace(/^\/(en|de|tr)(?=\/)/, "");
  for (const m of GROWTH_MODULES) if (m.landingPath === path || m.paths.some(p => path === p || path.startsWith(p + "/"))) return m.id;
  return null;
}
