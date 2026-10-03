import Link from "@/components/marketing/PublicLink";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getServerLang } from "@/lib/i18n/server";
import { copy, features, solutionCatalog, text } from "@/lib/marketing/catalog";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import PublicShell from "@/components/marketing/PublicShell";
import Ecosystem from "@/components/marketing/Ecosystem";
import { FeatureCards, FinalCTA, Workflow } from "@/components/marketing/Sections";
import JsonLd from "@/components/seo/JsonLd";
import { solutionDetails } from "@/lib/marketing/solutionDetails";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const solution = solutionCatalog.find(s => s.slug === params.slug);
  if (!solution) return {};
  const lang = await getServerLang();
  const description = solutionDetails[solution.slug].description;
  return pageMetadata(lang, `/solutions/${solution.slug}`, { fa: solution.title[0], en: solution.title[1], de: solution.title[2], tr: solution.title[3] }, { fa: description[0], en: description[1], de: description[2], tr: description[3] });
}
export default async function SolutionPage({ params }: { params: { slug: string } }) {
  const solution = solutionCatalog.find(s => s.slug === params.slug);
  if (!solution) notFound();
  const lang = await getServerLang();
  const selected = features.filter(f => solution.modules.includes(f.slug));
  const details = solutionDetails[solution.slug];
  return <PublicShell lang={lang}><JsonLd data={pageJsonLd(lang, `/solutions/${solution.slug}`, "WebPage", text(lang, solution.title))}/>
    <section className="m-detail-hero"><div className="m-container"><span className="m-eyebrow">AIFekr / {text(lang, copy.solutions)}</span><h1>{text(lang, solution.title)}</h1><p>{text(lang, details.description)}</p><div className="m-actions"><Link className="m-button" href="/register">{text(lang, copy.start)}<ArrowUpRight size={18}/></Link><Link className="m-button m-secondary" href="/pricing">{text(lang, copy.pricing)}</Link></div></div></section>
    <section className="m-container m-section"><h2 className="m-section-title">{text(lang, ["نمونهٔ یک جریان کاری", "A practical workflow", "Ein praktischer Arbeitsablauf", "Pratik bir iş akışı"])}</h2>{details.steps.map((step, index) => <article className="m-story-step" key={index}><h3>{index + 1}. {text(lang, step.title)}</h3><p>{text(lang, step.body)}</p></article>)}<Link className="m-text-link" href={`/guides/${details.guide}`}>{text(lang, ["راهنمای مرحله‌به‌مرحله", "Read the step-by-step guide", "Schritt-für-Schritt-Leitfaden lesen", "Adım adım rehberi okuyun"])}<ArrowUpRight size={16}/></Link></section>
    <section className="m-container m-section"><FeatureCards lang={lang} selected={selected}/></section>
    <section className="m-container m-section m-divider"><Workflow lang={lang}/></section>
    <section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, copy.ecosystem)}</h2><p className="m-section-desc">{text(lang, copy.demo)}</p><Ecosystem lang={lang}/></section>
    <section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, copy.requirements)}</h2>{selected.map(f => <div className="m-story-step" key={f.slug}><h3>{text(lang, f.title)}</h3><p>{text(lang, f.requirement)}</p></div>)}</section>
    <section className="m-container m-section"><FinalCTA lang={lang}/></section>
  </PublicShell>;
}
