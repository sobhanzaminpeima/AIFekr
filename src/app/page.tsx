import Link from "@/components/marketing/PublicLink";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {verifyToken} from "@/lib/auth/jwt";
import {prisma} from "@/lib/db/prisma";
import { ArrowUpRight } from "lucide-react";
import { getServerLang } from "@/lib/i18n/server";
import { copy, text, features } from "@/lib/marketing/catalog";

// The modules most visitors come for; the others sit behind "see all".
const LEAD_FEATURES = ["assistant", "crm", "content", "video", "accounting", "education"];

import PublicShell from "@/components/marketing/PublicShell";
import Ecosystem from "@/components/marketing/Ecosystem";
import EntryPlans from "@/components/ai-chat/EntryPlans";

import { FeatureCards, SolutionCards, IndustryLinks, CreditExplanation, FAQ, FinalCTA, Workflow, GuideLinks } from "@/components/marketing/Sections";
import JsonLd from "@/components/seo/JsonLd";
import { homeJsonLd, homeMetadata } from "@/lib/seo/publicSeo";
import ChatLaunch from "@/components/marketing/ChatLaunch";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return homeMetadata(await getServerLang());
}
export default async function HomePage() {
  const session = verifyToken((await cookies()).get("token")?.value || "");
  if (session) {
    const user = await prisma.user.findUnique({where:{id:session.userId},select:{isBlocked:true}});
    if (user && !user.isBlocked) redirect("/chat");
  }
  const lang = await getServerLang();

  return <PublicShell lang={lang}>
    <JsonLd data={homeJsonLd(lang)} />
    <section className="m-hero"><div className="m-container"><span className="m-eyebrow">{text(lang, copy.eyebrow)}</span><h1>{text(lang, copy.hero).split("\n")[0]}<br/><em>{text(lang, copy.hero).split("\n")[1]}</em></h1><p>{text(lang, copy.intro)}</p><div className="m-actions"><Link className="m-button" href="/explore">{text(lang, copy.start)}<ArrowUpRight size={18}/></Link><Link className="m-button m-secondary" href="#platform">{text(lang, copy.explore)}</Link></div><p className="m-caption">{text(lang, copy.noPromise)}</p><Ecosystem lang={lang} compact/></div></section>
    <ChatLaunch lang={lang}/>
    <section className="m-container m-section"><Workflow lang={lang}/></section>
    <section className="m-container m-section m-divider" id="platform"><span className="m-eyebrow">{text(lang, copy.product)}</span><h2 className="m-section-title">{text(lang, copy.modules)}</h2><p className="m-section-desc">{text(lang, copy.modulesDesc)}</p>{/* Six lead modules up front; the rest stay in the HTML (indexable) behind
        a toggle, which took this section from ~3,600px to about a third. */}<FeatureCards lang={lang} selected={LEAD_FEATURES.map(slug => features.find(f => f.slug === slug)!).filter(Boolean)}/><details className="m-more-features"><summary>{text(lang, ["مشاهدهٔ همهٔ ماژول‌ها", "See all modules", "Alle Module ansehen", "Tüm modülleri gör"])}</summary><FeatureCards lang={lang} selected={features.filter(f => !LEAD_FEATURES.includes(f.slug))}/></details></section>
    <section className="m-container m-section m-divider"><span className="m-eyebrow">{text(lang, copy.solutions)}</span><h2 className="m-section-title">{text(lang, copy.useCases)}</h2><p className="m-section-desc">{text(lang, copy.noPromise)}</p><SolutionCards lang={lang}/></section>
    <section className="m-container m-section m-divider"><span className="m-eyebrow">{text(lang, copy.industries)}</span><h2 className="m-section-title">{text(lang, copy.industries)}</h2><p className="m-section-desc">{text(lang, copy.noPromise)}</p><IndustryLinks lang={lang}/></section>
    <section className="m-container m-section m-pricing-section m-divider" id="pricing"><span className="m-eyebrow">{text(lang, copy.pricing)}</span><h2 className="m-section-title">{text(lang, ["پلن متناسب با کار شما", "A plan for your work", "Ein Tarif für Ihre Arbeit", "İşinize uygun paket"])}</h2><p className="m-section-desc">{text(lang, copy.plansDesc)}</p><EntryPlans lang={lang} embedded/><Link className="m-text-link" href="/pricing">{text(lang, ["جزئیات قیمت‌گذاری و پرداخت", "Pricing and payment details", "Preis- und Zahlungsdetails", "Fiyat ve ödeme ayrıntıları"])}<ArrowUpRight size={16}/></Link></section>
    <section className="m-container m-section m-divider"><CreditExplanation lang={lang}/></section>
    <section className="m-container m-section m-divider"><GuideLinks lang={lang}/></section>
    <section className="m-container m-section m-divider"><h2 className="m-section-title">{text(lang, copy.faq)}</h2><FAQ lang={lang}/></section>
    <section className="m-container m-section"><FinalCTA lang={lang}/></section>
  </PublicShell>;
}
