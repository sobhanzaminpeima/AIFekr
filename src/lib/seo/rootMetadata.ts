import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n/server";
import { SITE_URL, SITE_NAME } from "./site";

const TITLE: Record<Lang, string> = {
  fa: "AIFekr — پلتفرم هوش مصنوعی فارسی",
  en: "AiFekr — AI Platform",
  de: "AiFekr — KI-Plattform",
  tr: "AiFekr — AI Platform",
};

const DESCRIPTION: Record<Lang, string> = {
  fa: "پلتفرم هوش مصنوعی — چت، تصویر، ویدیو، موسیقی و ابزارهای هوشمند کسب‌وکار",
  en: "AI Platform — Chat, Image, Video, Music & Smart Business Tools",
  de: "KI-Plattform — Chat, Bild, Video, Musik und intelligente Business-Tools",
  tr: "AI Platform — Chat, Image, Video, Music & Smart Business Tools",
};

/** Site-wide metadata from the root layout; also merged into new-design pages by publicSeo. */
export function siteRootMetadata(lang: Lang): Metadata {
  return {
    // Absolute base so canonical / Open Graph URLs resolve to aifekr.com, and a
    // template so every page that sets only a short title still gets the brand.
    metadataBase: new URL(SITE_URL),
    title: { default: TITLE[lang], template: "%s | AIFekr" },
    description: DESCRIPTION[lang],
    applicationName: SITE_NAME,
    openGraph: { type: "website", siteName: SITE_NAME, title: TITLE[lang], description: DESCRIPTION[lang], locale: ({ fa: "fa_IR", en: "en_US", de: "de_DE", tr: "tr_TR" } as const)[lang] },
    twitter: { card: "summary_large_image", title: TITLE[lang], description: DESCRIPTION[lang] },
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "AiFekr",
    },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}
