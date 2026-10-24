import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {boundedJson,factoryRoute} from "@/lib/video-factory/http";
import {projectVersions,restoreProjectVersion} from "@/lib/video-factory/versions";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>NextResponse.json({versions:await projectVersions(userId,params.id)}));
}
export async function POST(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>{const input=z.object({version:z.number().int().min(0),expectedVersion:z.number().int().min(0)}).strict().parse(await boundedJson(req));return NextResponse.json(await restoreProjectVersion(userId,params.id,input.version,input.expectedVersion));});
}
