import type { Lang } from "@/lib/i18n/server";

export const PUBLIC_LANGUAGES = ["fa", "en", "de", "tr"] as const;
export const PUBLIC_STATIC_ROUTES = ["/", "/pricing", "/industry", "/ai-team", "/about", "/contact", "/security", "/privacy", "/terms", "/guides"];
export function isPublicRoute(path: string) {
  return PUBLIC_STATIC_ROUTES.includes(path) || /^\/(features|solutions|industry|guides)\/[^/]+$/.test(path);
}
export function stripPublicLocale(path: string) {
  const match = path.match(/^\/(fa|en|de|tr)(\/.*)?$/);
  return match ? { lang: match[1] as Lang, path: match[2] || "/" } : { lang: "fa" as Lang, path };
}
export function localizedPublicPath(path: string, lang: Lang): string {
  const suffixAt = path.search(/[?#]/);
  const pathname = suffixAt < 0 ? path : path.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? "" : path.slice(suffixAt);
  const bare = stripPublicLocale(pathname).path;
  if (!isPublicRoute(bare)) return path;
  // Industry records currently have no Turkish translation. Link directly to
  // their English page instead of sending every visitor through a redirect.
  if (lang === "tr" && bare.startsWith("/industry/")) return `/en${bare}${suffix}`;
  return (lang === "fa" ? bare : `/${lang}${bare === "/" ? "" : bare}`) + suffix;
}
