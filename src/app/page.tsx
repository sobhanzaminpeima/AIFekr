import Link from "@/components/marketing/PublicLink";
import { ArrowUpRight } from "lucide-react";
import { getServerLang } from "@/lib/i18n/server";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo/site";
import { copy, text } from "@/lib/marketing/catalog";
import { getPublicPlans } from "@/lib/marketing/data";
import PublicShell from "@/components/marketing/PublicShell";
import Ecosystem from "@/components/marketing/Ecosystem";
import PricingComparison from "@/components/marketing/PricingComparison";
import { getFxRates } from "@/lib/utils/currency";
import StudentOffer from "@/components/marketing/StudentOffer";
import { getStudentPackage } from "@/lib/marketing/student";
import { FeatureCards, SolutionCards, IndustryLinks, CreditExplanation, FAQ, FinalCTA, Workflow, faqItems, GuideLinks } from "@/components/marketing/Sections";
import JsonLd from "@/components/seo/JsonLd";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const lang = await getServerLang();
  const meta = pageMetadata(lang, "/", { fa: "AIFekr | هوش مصنوعی کسب‌وکار، CRM و ابزارهای دانشجویی", en: "AIFekr | Business AI, CRM and Student Tools", de: "AIFekr | Business-KI, CRM und Lernwerkzeuge", tr: "AIFekr | İşletme Yapay Zekâsı, CRM ve Öğrenci Araçları" }, { fa: copy.intro[0], en: copy.intro[1], de: copy.intro[2], tr: copy.intro[3] });
  if (typeof meta.title === "string") meta.title = { absolute: meta.title };
  return meta;
}
export default async function HomePage() {
  const lang = await getServerLang();
  const [businessPlans, studentPlans, student, rates] = await Promise.all([getPublicPlans(lang, true), getPublicPlans(lang, "student"), getStudentPackage(), getFxRates()]);
  const plans = businessPlans === null || studentPlans === null ? null : [...businessPlans, ...studentPlans];
  return <PublicShell lang={lang}>
    <JsonLd data={[{ "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png` }, { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL, inLanguage: lang }, { "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE_NAME, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: text(lang, copy.intro) }, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.map(f => ({ "@type": "Question", name: text(lang, f.q), acceptedAnswer: { "@type": "Answer", text: text(lang, f.a) } })) }]} />
    <section className="m-hero"><div className="m-container"><span className="m-eyebrow">{text(lang, copy.eyebrow)}</span><h1>{text(lang, copy.hero).split("\n")[0]}<br/><em>{text(lang, copy.hero).split("\n")[1]}</em></h1><p>{text(lang, copy.intro)}</p><div className="m-actions"><Link className="m-button" href="/register">{text(lang, copy.start)}<ArrowUpRight size={18}/></Link><Link className="m-button m-secondary" href="#platform">{text(lang, copy.explore)}</Link></div><p className="m-caption">{text(lang, copy.noPromise)}</p><Ecosystem lang={lang} compact/></div></section>
    <section className="m-container m-section"><Workflow lang={lang}/></section>
    <section className="m-container m-section m-divider" id="platform"><span className="m-eyebrow">{text(lang, copy.product)}</span><h2 className="m-section-title">{text(lang, copy.modules)}</h2><p className="m-section-desc">{text(lang, copy.modulesDesc)}</p><FeatureCards lang={lang}/></section>
    <section className="m-container m-section m-divider"><span className="m-eyebrow">{text(lang, copy.solutions)}</span><h2 className="m-section-title">{text(lang, copy.useCases)}</h2><p className="m-section-desc">{text(lang, copy.noPromise)}</p><SolutionCards lang={lang}/></section>
    <section className="m-container m-section m-divider"><span className="m-eyebrow">{text(lang, copy.industries)}</span><h2 className="m-section-title">{text(lang, copy.industries)}</h2><p className="m-section-desc">{text(lang, copy.noPromise)}</p><IndustryLinks lang={lang}/></section>
    <section className="m-container m-section m-pricing-section m-divider" id="pricing"><span className="m-eyebrow">{text(lang, copy.pricing)}</span><h2 className="m-section-title">{text(lang, ["پلن متناسب با کار شما", "A plan for your work", "Ein Tarif für Ihre Arbeit", "İşinize uygun paket"])}</h2><p className="m-section-desc">{text(lang, copy.plansDesc)}</p><PricingComparison student={student} lang={lang} plans={plans} rates={rates}/><Link className="m-text-link" href="/pricing">{text(lang, ["جزئیات قیمت‌گذاری و پرداخت", "Pricing and payment details", "Preis- und Zahlungsdetails", "Fiyat ve ödeme ayrıntıları"])}<ArrowUpRight size={16}/></Link></section>
    <section className="m-container"><StudentOffer lang={lang} plan={student}/></section>
    <section className="m-container m-section m-divider"><CreditExplanation lang={lang}/></section>
    <section className="m-container m-section m-divider"><GuideLinks lang={lang}/></section>
    <section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, copy.faq)}</h2><FAQ lang={lang}/></section>
    <section className="m-container m-section"><FinalCTA lang={lang}/></section>
  </PublicShell>;
}
