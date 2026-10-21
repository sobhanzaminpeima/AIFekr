import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowUpLeft, ArrowUpRight, AudioLines, Building2, Check, ChevronDown, CircleDot, Stethoscope, Search, Video, BriefcaseBusiness, Globe2, Layers3, MessageSquare, Music2, PanelsTopLeft, Rocket, Sparkles, Users, Camera, Send, PlaySquare } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { landingCopy } from "@/lib/i18n/landing";
import type { UiLocale } from "@/lib/i18n/foundation";
import EnamadBadge from "@/components/layout/EnamadBadge";
import LandingHeader from "./LandingHeader";
import WorkspacePreview from "./WorkspacePreview";
import LandingPricing from "./LandingPricing";
import "@/styles/landing.css";

const featureIcons=[Users,PanelsTopLeft,AudioLines,Layers3];
const featureLinks=['/crm','/social','/voice-agent','/ceo/orchestrator'];
const moreIcons=[MessageSquare,Music2,Globe2,Rocket,Stethoscope,Search,Video,BriefcaseBusiness];
const moreLinks=['/chat','/music/generate','/website-designer','/startup/builder','/business-doctor','/seo','/meeting','/ceo'];

export default async function HomeLanding({locale}:{locale:UiLocale}){
 const token=(await cookies()).get('token')?.value;
 if(token&&verifyToken(token))redirect('/chat');
 const s=landingCopy[locale],Arrow=locale==='fa'?ArrowUpLeft:ArrowUpRight;
 const [plansResult,packsResult,socialResult]=await Promise.allSettled([
  prisma.package.findMany({where:{isActive:true},orderBy:{sortOrder:'asc'},take:3,select:{planCode:true,name:true,nameEn:true,price:true,priceUsd:true,credits:true,duration:true,isFeatured:true,market:true}}),
  prisma.industryPack.findMany({where:{isActive:true},orderBy:{sortOrder:'asc'},take:8,select:{id:true,slug:true,name:true,nameEn:true}}),
  prisma.siteSetting.findMany({where:{key:{in:['social_instagram','social_telegram','social_youtube']}},select:{key:true,value:true}}),
 ]);
 const plans=plansResult.status==='fulfilled'?plansResult.value:[];
 const packs=packsResult.status==='fulfilled'?packsResult.value:[];
 const socials=socialResult.status==='fulfilled'?socialResult.value:[];
 const socialKeys=['social_instagram','social_telegram','social_youtube'];const socialIcons=[Camera,Send,PlaySquare];
 return <div className="lp" dir={locale==='fa'?'rtl':'ltr'} lang={locale} data-ui-locale={locale}>
  <a href="#main-content" className="lp-skip">{s.skip}</a>
  <LandingHeader locale={locale}/>
  <main id="main-content" tabIndex={-1}>
   <section className="lp-shell lp-hero" aria-labelledby="hero-title">
    <div className="lp-hero-copy"><p className="lp-eyebrow"><span/>{s.eyebrow}</p><h1 id="hero-title">{s.hero1}<span>{s.hero2}</span></h1><p className="lp-hero-description">{s.heroDescription}</p><div className="lp-hero-actions"><Link className="ui-button lp-primary-cta" href="/register">{s.start}<Arrow size={19} aria-hidden="true"/></Link><a className="lp-secondary-cta" href="#workspace-preview">{s.explore}<ChevronDown size={17} aria-hidden="true"/></a></div><p className="lp-hero-note"><Check size={15} aria-hidden="true"/>{s.heroNote}</p>{s.handoff&&<p className="lp-hero-note">{s.handoff}</p>}</div>
    <WorkspacePreview locale={locale}/>
   </section>
   <div className="lp-shell"><div className="lp-capability-strip">{s.capabilityStrip.map((item,i)=>{const Icon=featureIcons[i];return <span key={item}><Icon size={18} aria-hidden="true"/>{item}</span>})}</div></div>
   <section id="capabilities" className="lp-section lp-shell" aria-labelledby="capabilities-title">
    <div className="lp-section-heading"><div><p className="lp-eyebrow">{s.featuresEyebrow}</p><h2 id="capabilities-title">{s.featuresTitle}</h2></div><p>{s.featuresDescription}</p></div>
    <div className="lp-features">{s.features.map((feature,i)=>{const Icon=featureIcons[i];return <article className="lp-feature" key={feature.role}><div className="lp-feature-top"><span className="lp-feature-icon"><Icon size={23} aria-hidden="true"/></span><span className="lp-feature-number">{String(i+1).padStart(2,'0')}</span></div><p className="lp-role">{feature.role}</p><h3>{feature.title}</h3><p>{feature.description}</p><div className="lp-feature-bottom"><div>{feature.tags.map(tag=><span key={tag}>{tag}</span>)}</div><Link href={featureLinks[i]} aria-label={`${s.featureLink}: ${feature.role}`}><Arrow size={20} aria-hidden="true"/></Link></div></article>})}</div>
    <div className="lp-more"><div><h3>{s.moreTitle}</h3><p>{s.moreDescription}</p></div><div className="lp-more-links">{s.moreLinks.map((label,i)=>{const Icon=moreIcons[i];return <Link href={moreLinks[i]} key={label}><Icon size={17} aria-hidden="true"/>{label}</Link>})}</div></div>
   </section>
   <section id="how-it-works" className="lp-section lp-process-section" aria-labelledby="how-title"><div className="lp-shell"><p className="lp-eyebrow">{s.howEyebrow}</p><h2 id="how-title">{s.howTitle}</h2><ol className="lp-steps">{s.steps.map((step,i)=><li key={step.title}><span className="lp-step-number">{String(i+1).padStart(2,'0')}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol><Link href="/ai-team" className="lp-text-link">{s.team}<Arrow size={16} aria-hidden="true"/></Link></div></section>
   <section className="lp-section lp-shell lp-industries" aria-labelledby="industry-title"><div><p className="lp-eyebrow">{s.packsEyebrow}</p><h2 id="industry-title">{s.packsTitle}</h2><p>{s.packsDescription}</p><Link href="/industry" className="lp-text-link">{s.allPacks}<Arrow size={16} aria-hidden="true"/></Link></div><div className="lp-pack-list">{packs.length?packs.map(pack=><Link href={`/industry/${encodeURIComponent(pack.slug)}`} key={pack.id}><Building2 size={20} aria-hidden="true"/><span>{s.industryNames[pack.slug]||(locale==='fa'?pack.name:pack.nameEn)||pack.name}</span><Arrow size={17} aria-hidden="true"/></Link>):<div className="lp-pack-empty"><Building2 size={32} aria-hidden="true"/><p>{s.packsEmpty}</p><Link href="/contact" className="lp-text-link">{s.contact}<Arrow size={16} aria-hidden="true"/></Link></div>}</div></section>
   <section id="pricing" className="lp-section lp-price-section" aria-labelledby="pricing-title"><div className="lp-shell"><div className="lp-centered-heading"><p className="lp-eyebrow">{s.pricingEyebrow}</p><h2 id="pricing-title">{s.pricingTitle}</h2><p>{s.pricingDescription}</p></div><LandingPricing plans={plans} locale={locale}/></div></section>
   <section id="faq" className="lp-section lp-shell lp-faq" aria-labelledby="faq-title"><div><p className="lp-eyebrow">{s.faqEyebrow}</p><h2 id="faq-title">{s.faqTitle}</h2><Link href="/contact" className="lp-text-link">{s.contact}<Arrow size={16} aria-hidden="true"/></Link></div><div>{s.faqs.map(faq=><details key={faq.q}><summary>{faq.q}<ChevronDown size={18} aria-hidden="true"/></summary><p>{faq.a}</p></details>)}</div></section>
   <section className="lp-shell lp-final-section"><div className="lp-final-cta"><Sparkles size={28} aria-hidden="true"/><h2>{s.ctaTitle}</h2><p>{s.ctaDescription}</p><Link href="/register" className="ui-button lp-primary-cta">{s.start}<Arrow size={18} aria-hidden="true"/></Link></div></section>
  </main>
  <footer className="lp-footer"><div className="lp-shell"><div className="lp-footer-grid"><div><Link href={`/${locale}`} className="lp-brand"><Image src="/logo.svg" alt="" width={32} height={32}/><span>AiFekr<span className="lp-brand-dot">.</span></span></Link><p>{s.footerDescription}</p><div className="lp-socials">{socialKeys.map((key,i)=>{const href=socials.find(row=>row.key===key)?.value;if(!href||!/^https?:\/\//i.test(href))return null;const Icon=socialIcons[i];return <a key={key} href={href} aria-label={s.socialLabels[i]} target="_blank" rel="noopener noreferrer"><Icon size={18} aria-hidden="true"/></a>})}</div></div><div><h3>{s.footerProduct}</h3><a href="#capabilities">{s.nav[0]}</a><a href="#pricing">{s.nav[2]}</a><Link href="/industry">{s.allPacks}</Link></div><div><h3>{s.footerCompany}</h3><Link href="/about">{s.about}</Link><Link href="/contact">{s.contact}</Link><Link href="/ai-team">{s.team}</Link></div><div><h3>{s.footerLegal}</h3><Link href="/privacy">{s.privacy}</Link><Link href="/terms">{s.terms}</Link><div className="lp-trust"><EnamadBadge label={s.trustSeal}/></div></div></div><div className="lp-footer-bottom"><span>© {new Intl.NumberFormat(locale,{useGrouping:false}).format(new Date().getFullYear())} {s.copyright}</span><span className="lp-footer-mark"><CircleDot size={14} aria-hidden="true"/> AIFEKR</span></div></div></footer>
 </div>;
}
