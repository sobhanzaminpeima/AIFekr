import Link from "@/components/marketing/PublicLink";
import { notFound } from "next/navigation";
import PublicShell from "@/components/marketing/PublicShell";
import JsonLd from "@/components/seo/JsonLd";
import { getServerLang } from "@/lib/i18n/server";
import { text, features, type Copy } from "@/lib/marketing/catalog";
import { guides, CONTENT_UPDATED_AT } from "@/lib/marketing/guides";
import { pageMetadata, pageJsonLd, absoluteUrl, SITE_NAME } from "@/lib/seo/site";
import { localizedPublicPath } from "@/lib/seo/locales";
import { FeatureCards } from "@/components/marketing/Sections";
const four = (copy: Copy) => ({ fa: copy[0], en: copy[1], de: copy[2], tr: copy[3] });
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const guide = guides.find(guide => guide.slug === params.slug);
  if (!guide) notFound();
  return pageMetadata(await getServerLang(), `/guides/${guide.slug}`, four(guide.title), four(guide.description));
}
export default async function GuidePage({ params }: { params: { slug: string } }) {
  const guide = guides.find(guide => guide.slug === params.slug);
  if (!guide) notFound();
  const lang = await getServerLang();
  const url = absoluteUrl(localizedPublicPath(`/guides/${guide.slug}`, lang));
  return <PublicShell lang={lang}><JsonLd data={[...pageJsonLd(lang, `/guides/${guide.slug}`, "WebPage", text(lang, guide.title)), { "@context": "https://schema.org", "@type": "Article", headline: text(lang, guide.title), description: text(lang, guide.description), url, mainEntityOfPage: url, inLanguage: lang, datePublished: CONTENT_UPDATED_AT, dateModified: CONTENT_UPDATED_AT, image: absoluteUrl("/opengraph-image"), author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") }, publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: absoluteUrl("/icon-512.png") } } }]}/>
    <article><header className="m-detail-hero"><div className="m-container"><Link href="/guides" className="m-text-link">{text(lang, ["همهٔ راهنماها", "All guides", "Alle Leitfäden", "Tüm rehberler"])}</Link><h1>{text(lang, guide.title)}</h1><p>{text(lang, guide.description)}</p><p className="m-caption">AIFekr · <time dateTime={CONTENT_UPDATED_AT}>{new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(CONTENT_UPDATED_AT))}</time></p></div></header>
    <div className="m-container m-guide-layout m-section"><nav className="m-guide-toc" aria-label={text(lang, ["فهرست راهنما", "Guide contents", "Inhaltsverzeichnis", "Rehber içeriği"])}>{guide.sections.map((section, index) => <a href={`#step-${index + 1}`} key={index}>{text(lang, section.title)}</a>)}</nav><div className="m-guide-article">{guide.sections.map((section, index) => <section id={`step-${index + 1}`} key={index}><h2>{text(lang, section.title)}</h2><p>{text(lang, section.body)}</p></section>)}<aside className="m-notice"><p>{text(lang, ["بسته و دسترسی مناسب را پیش از شروع انتخاب کنید. خروجی AI را پیش از استفاده بررسی کنید.", "Choose appropriate access before starting and review AI outputs before use.", "Passenden Zugriff wählen und KI-Ergebnisse vor der Nutzung prüfen.", "Başlamadan önce uygun erişimi seçin ve çıktıları kullanmadan önce inceleyin."])}</p><Link href="/pricing" className="m-text-link">{text(lang, ["مشاهدهٔ پلن‌ها", "View plans", "Tarife ansehen", "Paketleri görüntüle"])}</Link></aside></div></div></article>
    <section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, ["ابزارهای این مسیر", "Tools for this workflow", "Tools für diesen Ablauf", "Bu akışın araçları"])}</h2><FeatureCards lang={lang} selected={features.filter(feature => guide.related.includes(feature.slug))}/></section></PublicShell>;
}
