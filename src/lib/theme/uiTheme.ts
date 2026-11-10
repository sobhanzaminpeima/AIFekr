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
  "/create", "/gallery", "/image/gallery", "/image/generate", "/video/generate", "/music/generate", "/voice-studio", "/video-factory",
  // Phase 4: business modules (/accounting includes its sub-pages, e.g. /accounting/bank).
  "/crm", "/accounting", "/social", "/lead-gen", "/business-doctor", "/meeting", "/website-designer", "/referral", "/startup/builder",
  // Activation: goal-based onboarding (its classic wizard stays at /welcome/setup).
  "/welcome",
  // Legal pages (text shared with the classic pages: lib/marketing/legal.ts).
  "/privacy", "/terms", "/security",
  // Account pages.
  "/payments",
  // AIFekr Live: spoken conversation (lib/live/service.ts).
  "/live",
  // Packages inside the platform (activation prompts link here with ?category=).
  "/plans",
  // Bank-transfer orders.
  "/ai-chat", "/start", "/owner/login", "/startup/contact", "/verify-certificate", "/f", "/p", "/o", "/share", "/assistants",
  "/checkout", "/fitness/checkout", "/fitness/credits", "/fitness/payments",
  // Guided AI tools.
  "/tools",
  // Required mobile number step (lib/auth/phoneRequirement).
  "/complete-phone"];

export function isUiTheme(value: unknown): value is UiTheme {
  return value === "classic" || value === "v2";
}

/** App pages match only themselves: /home/anything is not a page the new design has. */
const EXACT_ROUTES = new Set(["/", "/home", "/create", "/gallery", "/image/gallery", "/image/generate", "/video/generate", "/music/generate", "/voice-studio", "/video-factory", "/crm", "/welcome", "/privacy", "/terms", "/security", "/payments", "/complete-phone"]);

const SEO_V2 = ["/seo", "/seo/intelligence", "/seo/sites", "/seo/agent-pipeline"];

export function v2Handles(path: string, routes: readonly string[] = V2_ROUTES) {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  // The public 1980s gallery is its own page, not a shared report.
  if(routes===V2_ROUTES&&clean==="/share/1980s")return false;
  // A public student profile; the signed-in tutor chat lives at /student/chat.
  if(routes===V2_ROUTES&&/^\/student\/(?!chat$)[^/]+$/.test(clean))return true;
  if(routes===V2_ROUTES&&["/fitness","/fitness/marketplace","/student","/play"].includes(clean))return process.env.UI_V2_FINAL_MODULES_ENABLED==="1";
  if(routes===V2_ROUTES&&["/credits","/wallet","/notifications"].includes(clean))return process.env.UI_V2_PROFILE_ENABLED==="1";
  if(routes===V2_ROUTES&&clean==="/settings")return process.env.UI_V2_PROFILE_ENABLED==="1";
  if(routes===V2_ROUTES&&clean==="/owner")return process.env.UI_V2_OWNER_ENABLED==="1";
  if(routes===V2_ROUTES&&clean==="/voice-agent")return process.env.UI_V2_CALL_CENTER_ENABLED==="1";
  if(routes===V2_ROUTES&&clean==="/learn")return process.env.UI_V2_ACADEMY_ENABLED==="1";
  if(routes===V2_ROUTES&&clean==="/organization/onboarding")return process.env.UI_V2_ORGANIZATION_ENABLED==="1";
  if(routes===V2_ROUTES&&["/ceo","/agents"].includes(clean)) return process.env.UI_V2_TEAM_ENABLED==="1";
  // SEO: the workspace and its former sub-pages (shown as views of the same workspace); deeper paths stay classic.
  if(routes===V2_ROUTES&&(clean==="/seo"||clean.startsWith("/seo/"))) return SEO_V2.includes(clean)&&process.env.UI_V2_SEO_ENABLED==="1";
  if(routes===V2_ROUTES&&(clean==="/startup/builder"||clean.startsWith("/startup/builder/"))) return clean==="/startup/builder"&&process.env.UI_V2_STARTUP_ENABLED==="1";
  if(routes===V2_ROUTES&&(clean==="/referral"||clean.startsWith("/referral/"))) return clean==="/referral"&&process.env.UI_V2_REFERRAL_ENABLED==="1";
  if(routes===V2_ROUTES&&(clean==="/website-designer"||clean.startsWith("/website-designer/"))) return clean==="/website-designer"&&process.env.UI_V2_WEBSITE_ENABLED==="1";
  if (routes === V2_ROUTES && ["/business-doctor","/meeting"].some(base=>clean===base||clean.startsWith(base+"/"))) return ["/business-doctor","/meeting"].includes(clean) && process.env.UI_V2_ADVISORY_ENABLED === "1";
  if (routes === V2_ROUTES && (clean === "/lead-gen" || clean.startsWith("/lead-gen/"))) return clean === "/lead-gen" && process.env.UI_V2_LEADS_ENABLED === "1";
  if (routes === V2_ROUTES && (clean === "/social" || clean.startsWith("/social/"))) return clean === "/social" && process.env.UI_V2_SOCIAL_ENABLED === "1";
  // Roll back only this migration without changing the site's overall design.
  if (routes === V2_ROUTES && (clean === "/accounting" || clean.startsWith("/accounting/")) && process.env.UI_V2_ACCOUNTING_ENABLED !== "1") return false;
  if (routes === V2_ROUTES && clean.startsWith("/accounting/") && !["overview", "journal", "accounts", "ledger-setup", "expenses", "bank", "payroll", "budgets", "tax", "close-period", "owner-statements", "assistant", "automation"].some(v => clean === `/accounting/${v}`) && !/^\/accounting\/accounts\/[^/]+$/.test(clean)) return false;
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
