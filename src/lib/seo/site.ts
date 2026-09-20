import type { Metadata } from "next";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";

/**
 * Single source of truth for AiFekr's own public SEO surface (robots.txt,
 * sitemap.xml, canonical URLs, social cards). Found missing/incomplete by
 * running the platform's own SEO audit against aifekr.com.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com").replace(/\/$/, "");
export const SITE_NAME = "AiFekr";

/** Pages a search engine should index (static ones; industry packs are added from the database). */
export const PUBLIC_PATHS: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/industry", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ai-team", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/register", priority: 0.5, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

/**
 * Areas that need a login (or are per-user share links). They redirect
 * unauthenticated visitors already; listing them in robots.txt as well keeps
 * crawlers from wasting budget and stops private URL patterns being probed.
 */
export const PRIVATE_PREFIXES = [
  "/api/", "/admin", "/owner", "/share/", "/p/", "/f/", "/o/", "/welcome",
  "/home", "/chat", "/create", "/image", "/video", "/music", "/gallery", "/agents", "/assistants", "/tools", "/credits", "/plans", "/referral", "/settings", "/organization", "/startup",
  "/accounting", "/business-doctor", "/ceo", "/crm", "/lead-gen", "/meeting", "/sales", "/seo", "/social", "/voice-agent", "/website-designer",
];

export function absoluteUrl(path: string): string {
  return SITE_URL + (path.startsWith("/") ? path : "/" + path);
}

type Text4 = { fa: string; en: string; de: string; tr?: string };

/**
 * Per-page metadata: unique title + description in the visitor's language, a
 * canonical URL, and Open Graph / Twitter tags. (Pages used to inherit one
 * identical title and description from the root layout.)
 */
export function pageMetadata(lang: Lang, path: string, title: Text4, description: Text4): Metadata {
  const t = tri(lang, title.fa, title.en, title.de, title.tr ?? title.en);
  const d = tri(lang, description.fa, description.en, description.de, description.tr ?? description.en);
  return {
    title: t,
    description: d,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: { type: "website", url: absoluteUrl(path), siteName: SITE_NAME, title: t, description: d, locale: ({ fa: "fa_IR", en: "en_US", de: "de_DE", tr: "tr_TR" } as const)[lang] },
    twitter: { card: "summary_large_image", title: t, description: d },
  };
}
