import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {boundedJson,factoryRoute} from "@/lib/video-factory/http";
import {projectVersions,restoreProjectVersion} from "@/lib/video-factory/versions";
export const dynamic="force-dynamic";
export function GET(req:NextRequest,{params}:{params:{id:string}}){return factoryRoute(req,false,async userId=>NextResponse.json({versions:await projectVersions(userId,params.id)}));}
export function POST(req:NextRequest,{params}:{params:{id:string}}){return factoryRoute(req,false,async userId=>{const input=z.object({version:z.number().int().min(0),expectedVersion:z.number().int().min(0)}).strict().parse(await boundedJson(req));return NextResponse.json(await restoreProjectVersion(userId,params.id,input.version,input.expectedVersion));});}
