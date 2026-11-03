import { NextRequest,NextResponse } from "next/server";
import { factoryRoute } from "@/lib/video-factory/http";
import { listResources } from "@/lib/video-factory/resources";
import { prisma } from "@/lib/db/prisma";
import {getPolicy} from "@/lib/video-factory/config";
import {getServerLang} from "@/lib/i18n/server";
import {packagePeriods,resolveOffer} from "@/lib/marketing/entryPlans";
import {RETIRED_PUBLIC_PLAN_CODES} from "@/lib/billing/packageCategories";
export const dynamic="force-dynamic";
/**
 * The video packages a visitor can buy, each priced like the landing (resolveOffer: the visitor's
 * currency, fixed price or an approved rate). Drafts, hidden, retired and unpriced offers are left out,
 * so no package is shown in another currency or offered without a price.
 */
async function purchasablePackages(){
 const lang=await getServerLang();
 const rows=await prisma.package.findMany({where:{category:"VIDEO_FACTORY",isActive:true,publicationStatus:"PUBLISHED",publicVisible:true,planCode:{notIn:RETIRED_PUBLIC_PLAN_CODES}},orderBy:{sortOrder:"asc"},select:{planCode:true,name:true,nameEn:true,price:true,priceUsd:true,priceTry:true,duration:true,baseCurrency:true,termPrices:true,credits:true,creditAllocation:true,entitlements:true,publicationStatus:true}});
 const priced=await Promise.all(rows.map(async p=>{const period=packagePeriods(p.termPrices)[0];return {...p,offer:period?await resolveOffer(p,period,lang):null};}));
 return priced.filter(p=>p.offer);
}
export function GET(req:NextRequest){return factoryRoute(req,false,async()=>NextResponse.json({capabilities:{silentOnly:(await getPolicy()).silentOnly,musicAvailable:!!(await getPolicy()).providers.music},packages:await purchasablePackages(),templates:(await listResources("TEMPLATE")).filter(t=>t.enabled),providers:await prisma.videoFactoryProvider.findMany({where:{enabled:true},select:{id:true,name:true,kind:true,model:true,health:true}})}));}
