"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, ArrowUpRight, Check, CreditCard } from "lucide-react";
import { landingCopy } from "@/lib/i18n/landing";
import type { UiLocale } from "@/lib/i18n/foundation";
import { formatAmount, planAmount, registrationHref, type LandingPlan, type LandingCurrency } from "@/lib/landing/pricing";
export default function LandingPricing({plans,locale}:{plans:LandingPlan[];locale:UiLocale}){
 const s=landingCopy[locale];const [currency,setCurrency]=useState<LandingCurrency>(locale==='fa'?'IRR':'USD');const Arrow=locale==='fa'?ArrowUpLeft:ArrowUpRight;
 if(!plans.length)return <div className="lp-unavailable"><CreditCard size={24} aria-hidden="true"/><h3>{s.pricingEmpty}</h3><p>{s.pricingEmptyDescription}</p><Link href="/contact" className="ui-button ui-button--secondary">{s.contact}</Link></div>;
 return <><div className="lp-pricing-controls"><label>{s.currency}<select className="ui-input" value={currency} onChange={e=>setCurrency(e.target.value as LandingCurrency)}><option value="IRR">{s.toman}</option><option value="USD">{s.usd}</option></select></label></div>
  <div className="lp-pricing-grid">{plans.map(plan=>{const amount=planAmount(plan,currency);return <article key={plan.planCode} className={`lp-plan ${plan.isFeatured?'lp-plan-featured':''}`}>
   <div className="lp-plan-heading"><h3>{s.planNames[plan.planCode]||(locale==='fa'?plan.name:plan.nameEn)||plan.planCode}</h3>{plan.isFeatured&&<span>{s.featured}</span>}</div>
   <div className="lp-price">{amount===null?<p>{s.priceUnavailable}</p>:<><strong>{amount===0?s.free:formatAmount(amount,locale)}</strong>{amount>0&&<span>{currency==='IRR'?s.toman:s.usd}</span>}</>}</div>
   <ul><li><Check size={16} aria-hidden="true"/>{formatAmount(plan.duration,locale)} {s.days}</li><li><Check size={16} aria-hidden="true"/>{formatAmount(plan.credits,locale)} {s.credits}</li></ul>
   <Link className={`ui-button ${plan.isFeatured?'':'ui-button--secondary'}`} href={registrationHref(plan.planCode)}>{s.choosePlan}<Arrow size={16} aria-hidden="true"/></Link>
  </article>})}</div><div className="lp-section-end"><Link href="/register" className="lp-text-link">{s.allPlans}<Arrow size={16} aria-hidden="true"/></Link></div></>;
}
