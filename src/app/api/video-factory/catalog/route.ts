import { NextRequest,NextResponse } from "next/server";
import { factoryRoute } from "@/lib/video-factory/http";
import { listResources } from "@/lib/video-factory/resources";
import { prisma } from "@/lib/db/prisma";
import {getPolicy} from "@/lib/video-factory/config";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,false,async()=>NextResponse.json({capabilities:{silentOnly:(await getPolicy()).silentOnly},packages:await prisma.package.findMany({where:{category:"VIDEO_FACTORY",isActive:true,publicationStatus:{not:"ARCHIVED"}},select:{planCode:true,name:true,nameEn:true,priceUsd:true,credits:true,entitlements:true,publicationStatus:true}}),templates:(await listResources("TEMPLATE")).filter(t=>t.enabled),providers:await prisma.videoFactoryProvider.findMany({where:{enabled:true},select:{id:true,name:true,kind:true,model:true,health:true}})}));}
