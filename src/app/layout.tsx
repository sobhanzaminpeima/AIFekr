import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { getServerLang, type Lang } from "@/lib/i18n/server";
import { SITE_URL, SITE_NAME } from "@/lib/seo/site";

// This file used to resolve its own `lang` from a local `readLang(cookie)`
// helper that unconditionally fell back to "fa" -- it never consulted the
// admin's "default_language" SiteSetting at all (that fallback only lived in
// getServerLang(), which this file wasn't calling), so an admin picking
// English/German as the site default had literally no effect on a first-time
// visitor with no `lang` cookie yet. getServerLang() is the one place that
// already implements cookie -> DB setting -> "fa" correctly; this file now
// shares it instead of re-deriving (and silently regressing) the same fallback.

const TITLE: Record<Lang, string> = {
  fa: "هوشمند AI — پلتفرم هوش مصنوعی",
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

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return {
    // Absolute base so canonical / Open Graph URLs resolve to aifekr.com, and a
    // template so every page that sets only a short title still gets the brand.
    metadataBase: new URL(SITE_URL),
    title: { default: TITLE[lang], template: "%s | AiFekr" },
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale: 1 used to be set here, which blocks pinch-zoom: an accessibility
  // failure that Google's mobile-usability checks also flag.
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = await getServerLang();
  const dir = lang === "fa" ? "rtl" : "ltr";
  const theme = (cookieStore.get("theme")?.value === "light") ? "light" : "dark";

  return (
    <html lang={lang} dir={dir} data-theme={theme}>
      <body className="antialiased">
        <LangProvider lang={lang}>{children}</LangProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1a1a1a",
              color: "#f5f5f5",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "Vazirmatn, sans-serif",
              direction: dir,
            },
          }}
        />
      </body>
    </html>
  );
}
