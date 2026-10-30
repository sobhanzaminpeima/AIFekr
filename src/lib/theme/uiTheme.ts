import { prisma } from "@/lib/db/prisma";

/**
 * Two complete designs share one backend: "classic" (this app's pages) and
 * "v2" (the new design, a separate Next app the proxy forwards to). A page
 * renders in v2 only when the chosen theme is v2, the page is in V2_ROUTES and
 * the v2 app answers its health check; anything else renders classic, so an
 * unfinished or unavailable v2 page never reaches a visitor.
 */
export type UiTheme = "classic" | "v2";
export const UI_THEME_SETTING = "ui_theme";
/** Admin-only browser override, so a theme can be reviewed before it goes live for everyone. */
export const UI_PREVIEW_COOKIE = "aifekr_ui_preview";
/**
 * Public path prefix for the v2 app's build assets (/_v2/_next/...). Its root
 * files (/art/*.svg, /fonts/Vazirmatn) are copies in this app's public folder.
 */
export const V2_ASSET_PREFIX = "/_v2";

/** Pages rebuilt in v2 and connected to the real backend. An entry matches the path itself and everything under it. */
// Phase 1: landing and public pages. Privacy, terms, security, industry and
// the other public pages stay classic until they are rebuilt.
// Phase 2: sign-in, sign-up, the signed-in home and chat (/chat and
// /chat/<id>). App pages use their own frame (/api/app/shell).
export const V2_ROUTES: readonly string[] = ["/", "/pricing", "/about", "/contact", "/guides", "/features", "/solutions", "/login", "/register", "/home", "/chat",
  // Phase 3: creative studio, galleries, video and music studios.
  "/create", "/gallery", "/image/gallery", "/image/generate", "/video/generate", "/music/generate"];

export function isUiTheme(value: unknown): value is UiTheme {
  return value === "classic" || value === "v2";
}

/** App pages match only themselves: /home/anything is not a page the new design has. */
const EXACT_ROUTES = new Set(["/", "/home", "/create", "/gallery", "/image/gallery", "/image/generate", "/video/generate", "/music/generate"]);

export function v2Handles(path: string, routes: readonly string[] = V2_ROUTES) {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  return routes.some((route) => EXACT_ROUTES.has(route) ? clean === route : clean === route || clean.startsWith(route + "/"));
}

/** Preview cookie wins over the site-wide setting; an unknown value is ignored. */
export function resolveTheme(siteTheme: UiTheme, preview: string | undefined): UiTheme {
  return isUiTheme(preview) ? preview : siteTheme;
}

export function v2Origin(): string | null {
  const raw = process.env.UI_V2_ORIGIN;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

const TTL_MS = 30_000;
let themeCache: { at: number; theme: UiTheme } | null = null;
let healthCache: { at: number; ok: boolean } | null = null;

/** Site-wide theme, cached like module status because the proxy reads it on every page request. */
export async function siteUiTheme(): Promise<UiTheme> {
  if (themeCache && Date.now() - themeCache.at < TTL_MS) return themeCache.theme;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: UI_THEME_SETTING } });
    themeCache = { at: Date.now(), theme: isUiTheme(row?.value) ? row.value : "classic" };
  } catch {
    themeCache = { at: Date.now(), theme: themeCache?.theme ?? "classic" };
  }
  return themeCache.theme;
}

const LANGS = ["fa", "en", "de", "tr"] as const;
type Lang = (typeof LANGS)[number];
let langCache: { at: number; lang: Lang } | null = null;

/**
 * Language of a page without one in its URL, decided like getServerLang():
 * the visitor's lang cookie, else the admin's default_language setting.
 */
export async function pageLang(cookieLang: string | undefined): Promise<Lang> {
  if (LANGS.includes(cookieLang as Lang)) return cookieLang as Lang;
  if (!langCache || Date.now() - langCache.at >= TTL_MS) {
    try {
      const row = await prisma.siteSetting.findUnique({ where: { key: "default_language" } });
      langCache = { at: Date.now(), lang: LANGS.includes(row?.value as Lang) ? (row!.value as Lang) : "fa" };
    } catch {
      langCache = { at: Date.now(), lang: langCache?.lang ?? "fa" };
    }
  }
  return langCache.lang;
}

export function forgetSiteUiTheme() {
  themeCache = null;
}

/** True when the v2 app is configured and answered its health check recently. Never throws. */
export async function v2Available(): Promise<boolean> {
  const origin = v2Origin();
  if (!origin) return false;
  if (healthCache && Date.now() - healthCache.at < 10_000) return healthCache.ok;
  let ok = false;
  try {
    const res = await fetch(`${origin}/v2-health`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    ok = res.ok;
  } catch {
    ok = false;
  }
  healthCache = { at: Date.now(), ok };
  return ok;
}
