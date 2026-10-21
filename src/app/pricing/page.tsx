import { getServerLang } from "@/lib/i18n/server";
import { copy, text } from "@/lib/marketing/catalog";
import { getPublicPlans } from "@/lib/marketing/data";
import { pageMetadata, pageJsonLd } from "@/lib/seo/site";
import PublicShell from "@/components/marketing/PublicShell";
import PlanPicker from "@/components/marketing/PlanPicker";
import PricingComparison from "@/components/marketing/PricingComparison";
import { getFxRates } from "@/lib/utils/currency";
import StudentOffer from "@/components/marketing/StudentOffer";
import { getStudentPackage } from "@/lib/marketing/student";
import { CreditExplanation, FAQ, FinalCTA } from "@/components/marketing/Sections";
import JsonLd from "@/components/seo/JsonLd";
export const dynamic = "force-dynamic";
export async function generateMetadata() { const lang = await getServerLang(); return pageMetadata(lang, "/pricing", { fa: copy.pricing[0], en: copy.pricing[1], de: copy.pricing[2], tr: copy.pricing[3] }, { fa: copy.plansDesc[0], en: copy.plansDesc[1], de: copy.plansDesc[2], tr: copy.plansDesc[3] }); }
export default async function PricingPage() {
  const lang = await getServerLang();
  const [plans, business, studentPlans, student, rates] = await Promise.all([getPublicPlans(lang), getPublicPlans(lang, true), getPublicPlans(lang, "student"), getStudentPackage(), getFxRates()]);
  return <PublicShell lang={lang}><JsonLd data={pageJsonLd(lang, "/pricing")}/><section className="m-detail-hero m-pricing-hero"><div className="m-container"><span className="m-eyebrow">AIFekr / {text(lang, copy.pricing)}</span><h1>{text(lang, copy.pricing)}</h1><p>{text(lang, copy.plansDesc)}</p></div></section>
    <section className="m-container m-section m-pricing-section"><PricingComparison student={student} lang={lang} plans={business === null || studentPlans === null ? null : [...business, ...studentPlans]} rates={rates}/></section>
    <section className="m-container"><details className="m-free-details m-student-offer-details"><summary>{text(lang, ["اشتراک دانشجویی و پیشنهاد اولین خرید", "Student subscription and welcome offer", "Studierendenabo und Willkommensangebot", "Öğrenci aboneliği ve hoş geldin teklifi"])}</summary><StudentOffer lang={lang} plan={student}/></details></section>
    <section className="m-container m-section m-pricing-section m-divider"><details className="m-free-details"><summary>{text(lang, ["امکانات حساب رایگان", "Free account features", "Funktionen des kostenlosen Kontos", "Ücretsiz hesap özellikleri"])}</summary><PlanPicker lang={lang} plans={plans}/></details></section>
    <section className="m-container m-section m-pricing-section m-divider"><CreditExplanation lang={lang}/></section><section className="m-container m-section m-pricing-section m-divider"><h2 className="m-section-title">{text(lang, copy.faq)}</h2><FAQ lang={lang}/></section><section className="m-container m-section m-pricing-section"><FinalCTA lang={lang}/></section></PublicShell>;
}
