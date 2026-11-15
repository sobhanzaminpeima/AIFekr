import {NextRequest,NextResponse} from "next/server";
import {factoryRoute} from "@/lib/video-factory/http";
import {getPolicy} from "@/lib/video-factory/config";
import {commercialEstimate,detailedCommercialSchema} from "@/lib/video-factory/economics";
import {defaultRateCard,productionCost} from "@/lib/video-factory/costing";
import {prisma} from "@/lib/db/prisma";
import {boundedJson} from "@/lib/video-factory/http";
import {repriceVideoDrafts} from "@/lib/video-factory/packagePricing";
import {z} from "zod";
export const dynamic="force-dynamic";
/** Read-only price math for the admin editor (ESTIMATE never saves), or REPRICE_DRAFTS. */
export function POST(req:NextRequest){return factoryRoute(req,true,async actorId=>{
 const body=z.discriminatedUnion("action",[z.object({action:z.literal("REPRICE_DRAFTS")}).strict(),z.object({action:z.literal("ESTIMATE"),commercial:z.unknown()}).strict()]).parse(await boundedJson(req));
 if(body.action==="ESTIMATE"){
  const commercial=detailedCommercialSchema.parse(body.commercial);
  let perMinute:ReturnType<typeof productionCost>|null=null;try{if(commercial.rateCard)perMinute=productionCost(commercial.rateCard,1);}catch{/* invalid draft rates: no per-minute figure */}
  let example:ReturnType<typeof commercialEstimate>|null=null;try{example=commercialEstimate(commercial,480);}catch{/* invalid draft */}
  return NextResponse.json({example,perMinute,defaultRateCard},{headers:{"Cache-Control":"no-store"}});
 }
 return NextResponse.json({updated:await repriceVideoDrafts(actorId),salesEnabled:false,paidRequests:0});});}
export function GET(req:NextRequest){return factoryRoute(req,true,async()=>{const policy=await getPolicy();return NextResponse.json({salesLocked:process.env.VIDEO_FACTORY_SALES_APPROVED!=="true",example:commercialEstimate(policy.commercial,600),packages:await prisma.package.findMany({where:{isActive:true,priceUsd:{gt:0},credits:{gt:0}},select:{planCode:true,priceUsd:true,credits:true}})},{headers:{"Cache-Control":"no-store"}});});}
