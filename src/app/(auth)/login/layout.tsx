import type { Metadata } from "next";
import { getServerLang } from "@/lib/i18n/server";
import { loginMetadata } from "@/lib/seo/authSeo";

// The login page has no content worth ranking; keep it out of the index (links on it are still followed).
export async function generateMetadata(): Promise<Metadata> {
  return loginMetadata(await getServerLang());
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
