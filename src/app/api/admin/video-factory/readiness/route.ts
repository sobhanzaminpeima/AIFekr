import {NextRequest,NextResponse} from "next/server";
import {factoryRoute} from "@/lib/video-factory/http";
import {factoryReadiness} from "@/lib/video-factory/readiness";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,true,async()=>NextResponse.json(await factoryReadiness(),{headers:{"Cache-Control":"no-store"}}));}
