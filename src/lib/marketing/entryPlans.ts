import {prisma} from "@/lib/db/prisma";
import type {Lang} from "@/lib/i18n/server";
import {priceForPeriod} from "@/lib/billing/plans";
import {fixedPackagePrice} from "@/lib/billing/fixedPrices";
import {currencyConvert} from "@/lib/billing/rates";
import {parseFeatures} from "@/lib/marketing/features";

export type EntryPlan={code:string;name:string;category:string;minor:number;currency:string;credits:number;days:number;featured:boolean;features:string[]};

/** Published packages priced for the visitor's language; shared by the classic pricing page and the public site API so both show the same prices. */
export async function getEntryPlans(lang:Lang):Promise<EntryPlan[]>{
 const rows=await prisma.package.findMany({where:{isActive:true,publicVisible:true,publicationStatus:"PUBLISHED",category:{in:["BUSINESS","STUDENT","FITNESS","CHAT_STARTER"]},NOT:{planCode:"CHAT_STARTER_30"}},orderBy:{sortOrder:"asc"}}),plans:EntryPlan[]=[];
 for(const p of rows){try{const base=priceForPeriod(p,"monthly"),currency=lang==="fa"?"IRT":lang==="tr"?"TRY":"USD",fixed=fixedPackagePrice(p,"monthly",currency),minor=fixed??(await currencyConvert(base.minor,base.currency,currency)).minor;plans.push({code:p.planCode,name:lang==="fa"?p.name:p.nameEn,category:p.category,minor,currency,credits:p.credits,days:p.category==="CHAT_STARTER"?30:p.duration,featured:p.isFeatured,features:parseFeatures(lang==="fa"?p.features:p.featuresEn||p.features).slice(0,5)});}catch{/* Unconfigured terms are not offered. */}}
 return plans;
}
