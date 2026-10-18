import {NextRequest,NextResponse} from "next/server";
import {factoryRoute} from "@/lib/video-factory/http";
import {getPolicy} from "@/lib/video-factory/config";
import {commercialEstimate} from "@/lib/video-factory/economics";
import {prisma} from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,true,async()=>{const policy=await getPolicy();return NextResponse.json({salesLocked:process.env.VIDEO_FACTORY_SALES_APPROVED!=="true",example:commercialEstimate(policy.commercial,600),packages:await prisma.package.findMany({where:{isActive:true,priceUsd:{gt:0},credits:{gt:0}},select:{planCode:true,priceUsd:true,credits:true}})},{headers:{"Cache-Control":"no-store"}});});}
