import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LandingPricing from "@/components/landing/home/LandingPricing";
import { describe, expect, it } from "vitest";
import { planAmount, formatAmount, registrationHref, type LandingPlan } from "./pricing";
import { landingCopy } from "@/lib/i18n/landing";
import { landingMetadata } from "./metadata";
const plan: LandingPlan={planCode:'PRO',name:'حرفه‌ای',nameEn:'Pro',price:3500000,priceUsd:null,credits:6000,duration:30,isFeatured:true,market:'BOTH'};
describe('landing pricing accuracy',()=>{
 it('never labels a missing USD price as free',()=>{expect(planAmount(plan,'USD')).toBeNull();expect(planAmount({...plan,priceUsd:0},'USD')).toBe(0);});
 it('converts stored rials and dollar cents exactly once',()=>{expect(planAmount(plan,'IRR')).toBe(350000);expect(planAmount({...plan,priceUsd:2950},'USD')).toBe(29.5);});
 it('rejects unusable prices instead of displaying invented amounts',()=>{expect(planAmount({...plan,priceUsd:NaN},'USD')).toBeNull();expect(planAmount({...plan,price:-1},'IRR')).toBeNull();});
 it('preserves plan handoff to the existing registration checkout flow',()=>{expect(registrationHref('PRO')).toBe('/register?plan=PRO');expect(registrationHref('FREE')).toBe('/register');expect(registrationHref('custom & plan')).toBe('/register?plan=custom%20%26%20plan');});
 it('keeps cents and local number formatting',()=>{expect(formatAmount(29.5,'de')).toBe('29,5');expect(formatAmount(29.5,'en')).toBe('29.5');});
});
describe('public locale completeness',()=>{
 const leaves=(value:unknown,prefix=''):string[]=> typeof value==='object'&&value!==null?Object.entries(value).flatMap(([key,item])=>leaves(item,`${prefix}.${key}`)):[prefix];
 it('has the same content keys in fa/en/de',()=>{expect(leaves(landingCopy.fa)).toEqual(leaves(landingCopy.en));expect(leaves(landingCopy.fa)).toEqual(leaves(landingCopy.de));});
 it.each(['fa','en','de'] as const)('serves language-specific SEO and canonical links in %s',locale=>{const meta=landingMetadata(locale);expect(meta.title).toBe(landingCopy[locale].metaTitle);expect(meta.description).toBe(landingCopy[locale].metaDescription);expect(meta.alternates?.canonical).toBe(`/${locale}`);expect(meta.alternates?.languages).toMatchObject({fa:'/fa',en:'/en',de:'/de'});});
});

 describe('pricing presentation',()=>{
 it('renders unavailable dollar pricing without a free claim and retains checkout link',()=>{const html=renderToStaticMarkup(createElement(LandingPricing,{plans:[plan],locale:'en'}));expect(html).toContain('Price not listed in this currency');expect(html).not.toContain('>Free<');expect(html).toContain('/register?plan=PRO');});
 it('renders an honest empty state with no purchase selection',()=>{const html=renderToStaticMarkup(createElement(LandingPricing,{plans:[],locale:'de'}));expect(html).toContain('Preise sind derzeit nicht verfügbar.');expect(html).not.toContain('/register?plan=');});
 });
