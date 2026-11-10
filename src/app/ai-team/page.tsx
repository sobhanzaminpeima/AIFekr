import PublicShell from "@/components/marketing/PublicShell";
import { getServerLang } from "@/lib/i18n/server";
import AiTeamPipeline from "@/components/landing/AiTeamPipeline";
import type { Metadata } from "next";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";
import { copy, text, features } from "@/lib/marketing/catalog";

import { AI_TEAM_DESCRIPTION, AI_TEAM_TITLE, aiTeamCopy } from "@/lib/marketing/aiTeamCopy";
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const meta = pageMetadata(lang, "/ai-team", AI_TEAM_TITLE, AI_TEAM_DESCRIPTION);
  return meta;
}

export default async function AiTeamPage() {
  const lang = await getServerLang();
  const s = aiTeamCopy(lang);


  return (
    <PublicShell lang={lang}><div className="m-public-existing">
      <JsonLd data={pageJsonLd(lang, "/ai-team")} />

      <div className="m-container m-notice"><h2>{text(lang, copy.requirements)}</h2><p>{text(lang, features.find(f => f.slug === "agents")!.requirement)}</p></div>
      <AiTeamPipeline s={s} />
    </div></PublicShell>
  );
}
