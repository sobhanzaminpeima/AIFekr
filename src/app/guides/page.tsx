import Link from "@/components/marketing/PublicLink";
import PublicShell from "@/components/marketing/PublicShell";
import { getServerLang } from "@/lib/i18n/server";
import { guides } from "@/lib/marketing/guides";
import { text, type Copy } from "@/lib/marketing/catalog";
import { pageJsonLd, pageMetadata } from "@/lib/seo/site";
import JsonLd from "@/components/seo/JsonLd";
import { GUIDES_TITLE as title, GUIDES_DESCRIPTION as description } from "@/lib/seo/publicSeo";
const four = (copy: Copy) => ({ fa: copy[0], en: copy[1], de: copy[2], tr: copy[3] });
export async function generateMetadata() { return pageMetadata(await getServerLang(), "/guides", four(title), four(description)); }
export default async function GuidesPage() {
  const lang = await getServerLang();
  return <PublicShell lang={lang}><JsonLd data={pageJsonLd(lang, "/guides", "CollectionPage")}/><section className="m-detail-hero"><div className="m-container"><span className="m-eyebrow">AIFekr / {text(lang, ["راهنما", "Guides", "Leitfäden", "Rehberler"])}</span><h1>{text(lang, title)}</h1><p>{text(lang, description)}</p></div></section><section className="m-container m-section m-guides-grid">{guides.map(guide => <article key={guide.slug} className="m-card"><h2>{text(lang, guide.title)}</h2><p>{text(lang, guide.description)}</p><Link className="m-text-link" href={`/guides/${guide.slug}`}>{text(lang, ["خواندن راهنما", "Read the guide", "Leitfaden lesen", "Rehberi oku"])}</Link></article>)}</section></PublicShell>;
}
