/**
 * Pure WordPress helpers: which SEO plugin a site runs, which post-meta keys it
 * reads its title/description from, and whether a REST response proves the values
 * landed. No network access here.
 */
export type SeoPlugin = "yoast" | "rankmath" | null;

export interface SeoFields { title?: string; description?: string; focusKeyword?: string }

/** REST namespaces advertised at /wp-json/ reveal the installed SEO plugin. */
export function detectSeoPlugin(namespaces: string[]): SeoPlugin {
  if (namespaces.some((n) => n === "yoast/v1" || n.startsWith("yoast/"))) return "yoast";
  if (namespaces.some((n) => n === "rankmath/v1" || n.startsWith("rankmath/"))) return "rankmath";
  return null;
}

export const META_KEYS: Record<Exclude<SeoPlugin, null>, { title: string; description: string; focusKeyword: string }> = {
  yoast: { title: "_yoast_wpseo_title", description: "_yoast_wpseo_metadesc", focusKeyword: "_yoast_wpseo_focuskw" },
  rankmath: { title: "rank_math_title", description: "rank_math_description", focusKeyword: "rank_math_focus_keyword" },
};

/** Post-meta to send for the given plugin. WordPress ignores keys a plugin has not exposed to REST, so callers must verify. */
export function seoMetaFor(plugin: SeoPlugin, f: SeoFields): Record<string, string> {
  if (!plugin) return {};
  const k = META_KEYS[plugin];
  const out: Record<string, string> = {};
  if (f.title) out[k.title] = f.title;
  if (f.description) out[k.description] = f.description;
  if (f.focusKeyword) out[k.focusKeyword] = f.focusKeyword;
  return out;
}

export type FieldConfirmation = "confirmed" | "not_confirmed";

/**
 * Compares what we sent with the `meta` object WordPress returned. A key is only
 * "confirmed" if it comes back with the same value: an unregistered key is silently
 * dropped, and reporting success for it (as the old apply code did) is a lie.
 */
export function confirmMeta(sent: Record<string, string>, returned: unknown): Record<string, FieldConfirmation> {
  const meta = returned && typeof returned === "object" && !Array.isArray(returned) ? (returned as Record<string, unknown>) : {};
  const out: Record<string, FieldConfirmation> = {};
  for (const [key, value] of Object.entries(sent)) {
    const got = meta[key];
    const flat = Array.isArray(got) ? got[0] : got;
    out[key] = typeof flat === "string" && flat.trim() === value.trim() ? "confirmed" : "not_confirmed";
  }
  return out;
}

export const wpBase = (siteUrl: string): string => siteUrl.replace(/\/+$/, "");

export const editUrlFor = (siteUrl: string, id: number, type: "posts" | "pages" = "posts"): string =>
  `${wpBase(siteUrl)}/wp-admin/post.php?post=${id}&action=edit`;

/** Slug of a page URL: the last non-empty path segment, or null for the site root. */
export function slugFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : null;
  } catch { return null; }
}

/** Human explanation of what did or did not get applied, for the user (never claims more than was confirmed). */
export function summarizeApplication(plugin: SeoPlugin, confirmations: Record<string, FieldConfirmation>): { applied: number; notConfirmed: number } {
  const values = Object.values(confirmations);
  return { applied: values.filter((v) => v === "confirmed").length, notConfirmed: plugin ? values.filter((v) => v === "not_confirmed").length : values.length };
}
