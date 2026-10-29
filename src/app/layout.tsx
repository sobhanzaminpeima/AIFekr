import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "@/components/billing/billing.css";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";
import { LangProvider } from "@/lib/i18n/LangProvider";
import GrowthTracker from "@/components/growth/GrowthTracker";
import { getServerLang } from "@/lib/i18n/server";
import { siteRootMetadata } from "@/lib/seo/rootMetadata";

// This file used to resolve its own `lang` from a local `readLang(cookie)`
// helper that unconditionally fell back to "fa" -- it never consulted the
// admin's "default_language" SiteSetting at all (that fallback only lived in
// getServerLang(), which this file wasn't calling), so an admin picking
// English/German as the site default had literally no effect on a first-time
// visitor with no `lang` cookie yet. getServerLang() is the one place that
// already implements cookie -> DB setting -> "fa" correctly; this file now
// shares it instead of re-deriving (and silently regressing) the same fallback.

export async function generateMetadata(): Promise<Metadata> {
  return siteRootMetadata(await getServerLang());
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
      <head>
        <Script id="aifekr-google-tag-manager" strategy="beforeInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-5KPJ94DJ');
        `}</Script>
      </head>
      <body className="antialiased">
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5KPJ94DJ" height="0" width="0" style={{display:"none",visibility:"hidden"}} title="Google Tag Manager" /></noscript>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-PEZ7X47VRX" strategy="afterInteractive" />
        <Script id="aifekr-google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-PEZ7X47VRX');
        `}</Script>
        <LangProvider lang={lang}>{children}</LangProvider>
        <GrowthTracker />
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
