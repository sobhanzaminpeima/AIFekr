import { NextRequest,NextResponse } from "next/server";
import { factoryRoute } from "@/lib/video-factory/http";
import { listResources } from "@/lib/video-factory/resources";
import { prisma } from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,false,async()=>NextResponse.json({templates:(await listResources("TEMPLATE")).filter(t=>t.enabled),providers:await prisma.videoFactoryProvider.findMany({where:{enabled:true},select:{id:true,name:true,kind:true,model:true,health:true}})}));}
