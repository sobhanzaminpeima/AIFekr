import type { Metadata } from "next";
import { getServerLang } from "@/lib/i18n/server";
import { registerMetadata } from "@/lib/seo/authSeo";

export async function generateMetadata(): Promise<Metadata> {
  return registerMetadata(await getServerLang());
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
