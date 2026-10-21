import type { Metadata } from "next";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

// The login page has no content worth ranking; keep it out of the index (links on it are still followed).
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return {
    title: tri(lang, "ورود", "Log in", "Anmelden", "Giriş yap"),
    robots: { index: false, follow: true },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
