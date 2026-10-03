import { getServerLang } from "@/lib/i18n/server";
import { copy, text } from "@/lib/marketing/catalog";
import { getPublicPlans } from "@/lib/marketing/data";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import PublicShell from "@/components/marketing/PublicShell";
import PlanPicker from "@/components/marketing/PlanPicker";
import StudentOffer from "@/components/marketing/StudentOffer";
import { getStudentPackage } from "@/lib/marketing/student";
import { CreditExplanation, FAQ, FinalCTA } from "@/components/marketing/Sections";
import JsonLd from "@/components/seo/JsonLd";
export const dynamic = "force-dynamic";
export async function generateMetadata() { const lang = await getServerLang(); return pageMetadata(lang, "/pricing", { fa: copy.pricing[0], en: copy.pricing[1], de: copy.pricing[2], tr: copy.pricing[3] }, { fa: copy.plansDesc[0], en: copy.plansDesc[1], de: copy.plansDesc[2], tr: copy.plansDesc[3] }); }
export default async function PricingPage() {
  const lang = await getServerLang();
  const [plans, business, student] = await Promise.all([getPublicPlans(lang), getPublicPlans(lang, true), getStudentPackage()]);
  return <PublicShell lang={lang}><JsonLd data={pageJsonLd(lang, "/pricing")}/><section className="m-detail-hero"><div className="m-container"><span className="m-eyebrow">AIFekr / {text(lang, copy.pricing)}</span><h1>{text(lang, copy.pricing)}</h1><p>{text(lang, copy.plansDesc)}</p></div></section>
    <section className="m-container m-section"><h2 className="m-section-title">{text(lang, ["شروع رایگان", "Start free", "Kostenlos starten", "Ücretsiz başlayın"])}</h2><PlanPicker lang={lang} plans={plans}/></section>
    <section className="m-container"><StudentOffer lang={lang} plan={student}/></section>
    <section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, ["اشتراک کسب‌وکار و CRM", "Business & CRM subscriptions", "Business- & CRM-Abos", "İşletme ve CRM abonelikleri"])}</h2><p className="m-section-desc">{text(lang, copy.plansDesc)}</p><PlanPicker lang={lang} plans={business} business/></section>
    <section className="m-container m-section m-divider"><CreditExplanation lang={lang}/></section><section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, copy.faq)}</h2><FAQ lang={lang}/></section><section className="m-container m-section"><FinalCTA lang={lang}/></section></PublicShell>;
}
