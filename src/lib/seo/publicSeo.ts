import { LEGAL_META, LEGAL_PAGES, type LegalPage } from "@/lib/marketing/legal";
import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { copy, features, solutionCatalog, text, type Copy } from "@/lib/marketing/catalog";
import { guides, CONTENT_UPDATED_AT } from "@/lib/marketing/guides";
import { solutionDetails } from "@/lib/marketing/solutionDetails";
import { faqItems } from "@/components/marketing/Sections";
import { absoluteUrl, pageJsonLd, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo/site";
import { localizedPublicPath } from "@/lib/seo/locales";
import { siteRootMetadata } from "@/lib/seo/rootMetadata";

/**
 * Titles, descriptions and structured data of the public pages, in one place
 * so the classic pages and the new design (through /api/public/site) publish
 * exactly the same SEO for the same URL.
 */
type Text4 = { fa: string; en: string; de: string; tr: string };
const four = (c: Copy): Text4 => ({ fa: c[0], en: c[1], de: c[2], tr: c[3] });

export const HOME_TITLE: Text4 = { fa: "AIFekr | هوش مصنوعی کسب‌وکار، CRM و ابزارهای دانشجویی", en: "AIFekr | Business AI, CRM and Student Tools", de: "AIFekr | Business-KI, CRM und Lernwerkzeuge", tr: "AIFekr | İşletme Yapay Zekâsı, CRM ve Öğrenci Araçları" };
export const ABOUT_TITLE: Text4 = { fa: "درباره AIFekr؛ هوش مصنوعی برای کار و یادگیری", en: "About AIFekr: AI for work and learning", de: "Über AIFekr: KI für Arbeit und Lernen", tr: "AIFekr hakkında: iş ve öğrenim için yapay zekâ" };
export const ABOUT_DESCRIPTION: Text4 = { fa: "با AIFekr آشنا شوید: فضای یکپارچهٔ گفتگو، محتوا، CRM و مطالعه؛ با اعتبار مشخص، کنترل کاربر و بررسی خروجی‌های هوش مصنوعی.", en: "Meet AIFekr: a shared workspace for AI chat, content, CRM and learning, with clear credits, user control and review of AI output.", de: "AIFekr kennenlernen: ein gemeinsamer Bereich für KI-Chat, Inhalte, CRM und Lernen mit klaren Credits, Nutzerkontrolle und Prüfung der KI-Ausgaben.", tr: "AIFekr'i tanıyın: belirli krediler, kullanıcı kontrolü ve yapay zekâ çıktılarının incelenmesiyle sohbet, içerik, CRM ve öğrenim alanı." };
export const CONTACT_TITLE: Text4 = { fa: "تماس با ما — پشتیبانی و همکاری", en: "Contact Us — Support & Partnerships", de: "Kontakt — Support & Partnerschaften", tr: "İletişim — Destek ve İş Birliği" };
export const CONTACT_DESCRIPTION: Text4 = { fa: "با تیم AiFekr در ارتباط باشید: پشتیبانی، همکاری و سؤال درباره بسته‌های هوش مصنوعی صنعتی.", en: "Get in touch with the AiFekr team: support, partnerships and questions about our industry AI packs.", de: "Kontaktieren Sie das AiFekr-Team: Support, Partnerschaften und Fragen zu unseren Branchen-KI-Paketen.", tr: "AiFekr ekibiyle iletişime geçin: destek, iş birliği ve sektörel yapay zekâ paketleri hakkında sorular." };
export const GUIDES_TITLE: Copy = ["راهنمای کاربردی هوش مصنوعی برای کار و مطالعه", "Practical AI guides for work and study", "Praktische KI-Leitfäden für Arbeit und Studium", "İş ve öğrenim için uygulamalı yapay zekâ rehberleri"];
export const GUIDES_DESCRIPTION: Copy = ["راهنماهای AIFekr برای پیگیری مشتری، تولید محتوای سئو و برنامه‌ریزی مطالعه؛ با مراحل روشن، نمونهٔ کاربرد و محدودیت‌های واقعی ابزارها.", "AIFekr guides for customer follow-up, SEO content and study planning, with practical steps and real tool limitations.", "AIFekr-Leitfäden für Kundennachverfolgung, SEO-Inhalte und Lernplanung mit praktischen Schritten und tatsächlichen Grenzen.", "Müşteri takibi, SEO içeriği ve çalışma planı için pratik adımlar ve gerçek araç sınırlamaları içeren AIFekr rehberleri."];

export type PublicSeo = { metadata: Metadata; jsonLd: Record<string, unknown>[] };

export function homeMetadata(lang: Lang): Metadata {
  const meta = pageMetadata(lang, "/", HOME_TITLE, four(copy.intro));
  if (typeof meta.title === "string") meta.title = { absolute: meta.title };
  return meta;
}
export function homeJsonLd(lang: Lang): Record<string, unknown>[] {
  return [{ "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, alternateName: ["ای آی فکر", "آی‌فکر"], url: SITE_URL, logo: `${SITE_URL}/icon-512.png` }, { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL, inLanguage: lang }, { "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE_NAME, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: text(lang, copy.intro) }, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.map(f => ({ "@type": "Question", name: text(lang, f.q), acceptedAnswer: { "@type": "Answer", text: text(lang, f.a) } })) }];
}
export function featureJsonLd(lang: Lang, f: (typeof features)[number]): Record<string, unknown>[] {
  return [...pageJsonLd(lang, `/features/${f.slug}`, "WebPage", text(lang, f.title)), { "@context": "https://schema.org", "@type": "SoftwareApplication", name: `AIFekr ${text(lang, f.title)}`, description: text(lang, f.desc), applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: ["fa", "en", "de", "tr"], url: absoluteUrl(`/features/${f.slug}`), publisher: { "@type": "Organization", name: "AIFekr", url: SITE_URL } }];
}
export function guideJsonLd(lang: Lang, guide: (typeof guides)[number]): Record<string, unknown>[] {
  const url = absoluteUrl(localizedPublicPath(`/guides/${guide.slug}`, lang));
  return [...pageJsonLd(lang, `/guides/${guide.slug}`, "WebPage", text(lang, guide.title)), { "@context": "https://schema.org", "@type": "Article", headline: text(lang, guide.title), description: text(lang, guide.description), url, mainEntityOfPage: url, inLanguage: lang, datePublished: CONTENT_UPDATED_AT, dateModified: CONTENT_UPDATED_AT, image: absoluteUrl("/opengraph-image"), author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") }, publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: absoluteUrl("/icon-512.png") } } }];
}

/** SEO for a public path served in the new design, or null when the path is not one of those pages. */
export function publicSeo(lang: Lang, path: string): PublicSeo | null {
  if (path === "/") return { metadata: homeMetadata(lang), jsonLd: homeJsonLd(lang) };
  if (path === "/pricing") return { metadata: pageMetadata(lang, "/pricing", four(copy.pricing), four(copy.plansDesc)), jsonLd: pageJsonLd(lang, "/pricing", "WebPage", tri(lang, "قیمت پکیج‌های AIFekr", "AIFekr pricing", "AIFekr Preise", "AIFekr fiyatları")) };
  if (path === "/about") return { metadata: pageMetadata(lang, "/about", ABOUT_TITLE, ABOUT_DESCRIPTION), jsonLd: pageJsonLd(lang, "/about", "AboutPage") };
  if (path === "/contact") return { metadata: pageMetadata(lang, "/contact", CONTACT_TITLE, CONTACT_DESCRIPTION), jsonLd: pageJsonLd(lang, "/contact", "ContactPage") };
  const legal = (LEGAL_PAGES as readonly string[]).includes(path.slice(1)) ? (path.slice(1) as LegalPage) : null;
  if (legal) return { metadata: pageMetadata(lang, path, ...LEGAL_META[legal]), jsonLd: pageJsonLd(lang, path) };
  if (path === "/guides") return { metadata: pageMetadata(lang, "/guides", four(GUIDES_TITLE), four(GUIDES_DESCRIPTION)), jsonLd: pageJsonLd(lang, "/guides", "CollectionPage") };
  const [, section, slug, extra] = path.split("/");
  if (!slug || extra !== undefined) return null;
  if (section === "features") {
    const f = features.find(f => f.slug === slug);
    return f ? { metadata: pageMetadata(lang, `/features/${f.slug}`, four(f.title), four(f.desc)), jsonLd: featureJsonLd(lang, f) } : null;
  }
  if (section === "solutions") {
    const s = solutionCatalog.find(s => s.slug === slug);
    return s ? { metadata: pageMetadata(lang, `/solutions/${s.slug}`, four(s.title), four(solutionDetails[s.slug].description)), jsonLd: pageJsonLd(lang, `/solutions/${s.slug}`, "WebPage", text(lang, s.title)) } : null;
  }
  if (section === "guides") {
    const g = guides.find(g => g.slug === slug);
    return g ? { metadata: pageMetadata(lang, `/guides/${g.slug}`, four(g.title), four(g.description)), jsonLd: guideJsonLd(lang, g) } : null;
  }
  return null;
}

/**
 * The page metadata merged the way Next merges the classic root layout into a
 * page: page keys replace layout keys, and a plain page title gets the
 * layout's "%s | AIFekr" template. metadataBase is sent as a string.
 */
export function standaloneMetadata(lang: Lang, page: Metadata): Record<string, unknown> {
  const base = siteRootMetadata(lang);
  // The classic root's app/opengraph-image file gives Open Graph and Twitter
  // their image wherever a page does not set its own.
  const image = { url: "/opengraph-image", type: "image/png", width: 1200, height: 630, alt: "AiFekr — AI agents for your business" };
  const root = { ...base, openGraph: { ...base.openGraph, images: [image] }, twitter: { ...base.twitter, images: [image] } };
  const title = typeof page.title === "string" ? { absolute: `${page.title} | AIFekr` } : page.title ?? root.title;
  return { ...root, ...page, title, metadataBase: SITE_URL };
}
