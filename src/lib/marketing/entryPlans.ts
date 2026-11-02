import {prisma} from "@/lib/db/prisma";
import type {Lang} from "@/lib/i18n/server";
import {priceForPeriod} from "@/lib/billing/plans";
import {fixedPackagePrice} from "@/lib/billing/fixedPrices";
import {currencyConvert} from "@/lib/billing/rates";
import {parseFeatures} from "@/lib/marketing/features";
import {LANDING_PACKAGE_CATEGORIES,RETIRED_PUBLIC_PLAN_CODES} from '@/lib/billing/packageCategories';

export type EntryPlan={code:string;name:string;category:string;period:string;minor:number;currency:string;credits:number;days:number;featured:boolean;features:string[];compareAtMinor?:number};

/** Published packages priced for the visitor's language; shared by the classic pricing page and the public site API so both show the same prices. */
export async function getEntryPlans(lang:Lang):Promise<EntryPlan[]>{
 const rows=await prisma.package.findMany({where:{isActive:true,publicVisible:true,publicationStatus:"PUBLISHED",category:{in:LANDING_PACKAGE_CATEGORIES},planCode:{notIn:RETIRED_PUBLIC_PLAN_CODES}},orderBy:{sortOrder:"asc"}}),plans:EntryPlan[]=[];
 for(const p of rows){try{const terms=JSON.parse(p.termPrices||'{}');const period=['monthly','quarterly','semiannual','annual','custom'].find(k=>Number.isSafeInteger(terms[k])&&terms[k]>0)||(Object.keys(terms).length?'':'monthly');if(!period)continue;const base=priceForPeriod(p,period),currency=lang==="fa"?"IRT":lang==="tr"?"TRY":"USD",fixed=fixedPackagePrice(p,period,currency),minor=fixed??(await currencyConvert(base.minor,base.currency,currency)).minor;plans.push({period,compareAtMinor:currency==="IRT"?JSON.parse(p.entitlements||"{}").limits?.compareAtToman:undefined,code:p.planCode,name:lang==="fa"?p.name:p.nameEn,category:p.category,minor,currency,credits:p.credits*(p.creditAllocation==='MONTHLY_TOTAL'?base.months:1),days:base.days,featured:p.isFeatured,features:parseFeatures(lang==="fa"?p.features:p.featuresEn||p.features).slice(0,5)});}catch{/* Unconfigured terms are not offered. */}}
 return plans;
}
