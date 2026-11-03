import {prisma} from "@/lib/db/prisma";
import type {Lang} from "@/lib/i18n/server";
import {priceForPeriod} from "@/lib/billing/plans";
import {fixedPackagePrice} from "@/lib/billing/fixedPrices";
import {currencyConvert} from "@/lib/billing/rates";
import {parseFeatures} from "@/lib/marketing/features";
import {LANDING_PACKAGE_CATEGORIES,RETIRED_PUBLIC_PLAN_CODES} from '@/lib/billing/packageCategories';

export type EntryPlan={code:string;name:string;category:string;period:string;minor:number;currency:string;credits:number;days:number;featured:boolean;features:string[];compareAtMinor?:number};

type PricedPackage=Parameters<typeof priceForPeriod>[0]&{entitlements:string;credits:number;creditAllocation:string};
export type PackageOffer={period:string;minor:number;currency:string;credits:number;days:number;compareAtMinor?:number};
/** The visitor's currency: Toman in Persian, lira in Turkish, dollars otherwise (the checkout uses the same rule). */
export const offerCurrency=(lang:Lang)=>lang==="fa"?"IRT":lang==="tr"?"TRY":"USD";
/**
 * One package term priced in the visitor's currency: its fixed retail price, or a conversion with an
 * approved rate. null when neither exists -- the offer is then not shown anywhere (landing, /plans),
 * never shown in another currency. The quote (lib/billing/quotes.ts) prices the same way.
 */
export async function resolveOffer(p:PricedPackage,period:string,lang:Lang):Promise<PackageOffer|null>{
 try{const base=priceForPeriod(p,period),currency=offerCurrency(lang),fixed=fixedPackagePrice(p,period,currency),minor=fixed??(await currencyConvert(base.minor,base.currency,currency)).minor;
 return {period,minor,currency,credits:p.credits*(p.creditAllocation==='MONTHLY_TOTAL'?base.months:1),days:base.days,compareAtMinor:currency==="IRT"?JSON.parse(p.entitlements||"{}").limits?.compareAtToman:undefined};}catch{return null;}
}
/** The package's configured terms (monthly when it has none). */
export const packagePeriods=(termPrices:string|null|undefined)=>{const terms=JSON.parse(termPrices||'{}');return Object.keys(terms).length?['monthly','quarterly','semiannual','annual','custom'].filter(k=>Number.isSafeInteger(terms[k])&&terms[k]>0):['monthly'];};

/** Published packages priced for the visitor's language; shared by the classic pricing page and the public site API so both show the same prices. */
export async function getEntryPlans(lang:Lang):Promise<EntryPlan[]>{
 const rows=await prisma.package.findMany({where:{isActive:true,publicVisible:true,publicationStatus:"PUBLISHED",category:{in:LANDING_PACKAGE_CATEGORIES},planCode:{notIn:RETIRED_PUBLIC_PLAN_CODES}},orderBy:{sortOrder:"asc"}}),plans:EntryPlan[]=[];
 for(const p of rows){const period=packagePeriods(p.termPrices)[0];if(!period)continue;const offer=await resolveOffer(p,period,lang);if(!offer)continue;/* Unconfigured terms are not offered. */
  plans.push({period,compareAtMinor:offer.compareAtMinor,code:p.planCode,name:lang==="fa"?p.name:p.nameEn,category:p.category,minor:offer.minor,currency:offer.currency,credits:offer.credits,days:offer.days,featured:p.isFeatured,features:parseFeatures(lang==="fa"?p.features:p.featuresEn||p.features).slice(0,5)});}
 return plans;
}
