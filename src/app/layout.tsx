import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";
import { LangProvider } from "@/lib/i18n/LangProvider";

type Lang = "fa" | "en" | "de";

/**
 * Both this file's readers used to be written as `value === "en" ? "en" : "fa"`,
 * from back when the platform had two languages. German fell into the "fa"
 * branch, so every German visitor got `<html lang="fa" dir="rtl">` — a
 * right-to-left document with left-to-right text, plus a Persian <title>.
 */
function readLang(value: string | undefined): Lang {
  return value === "en" || value === "de" ? value : "fa";
}

const TITLE: Record<Lang, string> = {
  fa: "هوشمند AI — پلتفرم هوش مصنوعی",
  en: "AiFekr — AI Platform",
  de: "AiFekr — KI-Plattform",
};

const DESCRIPTION: Record<Lang, string> = {
  fa: "پلتفرم هوش مصنوعی — چت، تصویر، ویدیو، موسیقی و ابزارهای هوشمند کسب‌وکار",
  en: "AI Platform — Chat, Image, Video, Music & Smart Business Tools",
  de: "KI-Plattform — Chat, Bild, Video, Musik und intelligente Business-Tools",
};

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const lang = readLang(cookieStore.get("lang")?.value);
  return {
    title: TITLE[lang],
    description: DESCRIPTION[lang],
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
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = readLang(cookieStore.get("lang")?.value);
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
