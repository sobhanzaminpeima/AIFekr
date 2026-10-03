import Link from "@/components/marketing/PublicLink";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check } from "lucide-react";
import { getServerLang } from "@/lib/i18n/server";
import { copy, features, text } from "@/lib/marketing/catalog";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import PublicShell from "@/components/marketing/PublicShell";
import Ecosystem from "@/components/marketing/Ecosystem";
import FeaturePreview from "@/components/marketing/FeaturePreview";
import { FinalCTA, FeatureCards, GuideLinks } from "@/components/marketing/Sections";
import JsonLd from "@/components/seo/JsonLd";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const f = features.find(f => f.slug === params.slug);
  if (!f) return {};
  const lang = await getServerLang();
  return pageMetadata(lang, `/features/${f.slug}`, { fa: f.title[0], en: f.title[1], de: f.title[2], tr: f.title[3] }, { fa: f.desc[0], en: f.desc[1], de: f.desc[2], tr: f.desc[3] });
}
export default async function FeaturePage({ params }: { params: { slug: string } }) {
  const f = features.find(f => f.slug === params.slug);
  if (!f) notFound();
  const lang = await getServerLang();
  return <PublicShell lang={lang}><JsonLd data={pageJsonLd(lang, `/features/${f.slug}`, "WebPage", text(lang, f.title))}/>
    <section className="m-detail-hero"><div className="m-container"><span className="m-eyebrow">AIFekr / {text(lang, copy.product)}</span><h1>{text(lang, f.title)}</h1><p>{text(lang, f.desc)}</p><div className="m-actions"><Link className="m-button" href="/register">{text(lang, copy.start)}<ArrowUpRight size={18}/></Link><Link className="m-button m-secondary" href={f.route}>{text(lang, ["ورود به ابزار", "Open the workspace", "Arbeitsbereich öffnen", "Çalışma alanını açın"])}</Link></div></div></section>
    <section className="m-container m-section m-detail-grid"><div><span className="m-eyebrow">{text(lang, copy.product)}</span><h2 className="m-section-title">{text(lang, copy.modules)}</h2><ul className="m-detail-list">{f.items.map(item => <li key={item[1]}><Check size={20}/>{text(lang, item)}</li>)}</ul></div><aside className="m-notice"><h2>{text(lang, copy.requirements)}</h2><p>{text(lang, f.requirement)}</p><Link className="m-text-link" href="/pricing">{text(lang, copy.pricing)}<ArrowUpRight size={16}/></Link></aside></section>
    <section className="m-container m-section"><FeaturePreview lang={lang} slug={f.slug}/></section>
    <section className="m-container m-section"><GuideLinks lang={lang} feature={f.slug}/></section>
    <section className="m-container m-section m-divider"><span className="m-eyebrow">{text(lang, copy.demo)}</span><h2 className="m-section-title">{text(lang, copy.ecosystem)}</h2><p className="m-section-desc">{text(lang, copy.ecosystemDesc)}</p><Ecosystem lang={lang}/></section>
    <section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, ["در کنار این قابلیت", "Works alongside", "Passende weitere Tools", "Birlikte kullanabileceğiniz araçlar"])}</h2><FeatureCards lang={lang} selected={features.filter(other => other.category === f.category && other.slug !== f.slug).slice(0, 3)}/></section>
    <section className="m-container m-section"><FinalCTA lang={lang}/></section>
  </PublicShell>;
}
