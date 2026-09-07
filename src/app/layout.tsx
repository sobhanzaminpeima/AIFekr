import type { Metadata, Viewport } from "next";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "./globals.css";
import "@/styles/foundation.css";
import UiProvider from "@/components/ui/UiProvider";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value === "en") ? "en" : "fa";
  return {
    title: lang === "en" ? "AiFekr — AI Platform" : "هوشمند AI — پلتفرم هوش مصنوعی",
    description: "AI Platform — Chat, Image, Video, Music & Smart Business Tools",
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
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value === "en") ? "en" : "fa";
  const dir = lang === "en" ? "ltr" : "rtl";
  const theme = (cookieStore.get("theme")?.value === "light") ? "light" : "dark";

  return (
    <html lang={lang} dir={dir} data-theme={theme}>
      <body className="antialiased">
        <UiProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-body)",
                direction: dir,
              },
            }}
          />
        </UiProvider>
      </body>
    </html>
  );
}
