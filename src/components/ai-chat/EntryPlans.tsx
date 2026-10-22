import {cookies} from "next/headers";
import {verifyToken} from "@/lib/auth/jwt";
import {prisma} from "@/lib/db/prisma";
import type {Lang} from "@/lib/i18n/server";
import {priceForPeriod} from "@/lib/billing/plans";
import {fixedPackagePrice} from "@/lib/billing/fixedPrices";
import {currencyConvert} from "@/lib/billing/rates";
import {parseFeatures} from "@/lib/marketing/features";
import PlanChoice,{type EntryPlan} from "./PlanChoice";
export default async function EntryPlans({lang,initialGroup="CHAT",embedded=false}:{lang:Lang;initialGroup?:string;embedded?:boolean}){
 const payload=verifyToken(cookies().get("token")?.value||""),user=payload?await prisma.user.findUnique({where:{id:payload.userId},select:{isBlocked:true}}):null;
 const rows=await prisma.package.findMany({where:{isActive:true,publicVisible:true,publicationStatus:"PUBLISHED",category:{in:["BUSINESS","STUDENT","FITNESS","CHAT_STARTER"]},NOT:{planCode:"CHAT_STARTER_30"}},orderBy:{sortOrder:"asc"}}),plans:EntryPlan[]=[];
 for(const p of rows){try{const base=priceForPeriod(p,"monthly"),currency=lang==="fa"?"IRT":lang==="tr"?"TRY":"USD",fixed=fixedPackagePrice(p,"monthly",currency),minor=fixed??(await currencyConvert(base.minor,base.currency,currency)).minor;plans.push({code:p.planCode,name:lang==="fa"?p.name:p.nameEn,category:p.category,minor,currency,credits:p.credits,days:p.category==="CHAT_STARTER"?30:p.duration,featured:p.isFeatured,features:parseFeatures(lang==="fa"?p.features:p.featuresEn||p.features).slice(0,5)});}catch{/* Unconfigured terms are not offered. */}}
 return <PlanChoice plans={plans} authenticated={!!user&&!user.isBlocked} initialGroup={initialGroup} embedded={embedded}/>;
}
