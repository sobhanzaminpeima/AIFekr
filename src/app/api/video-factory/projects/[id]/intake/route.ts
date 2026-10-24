import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson,factoryRoute } from "@/lib/video-factory/http";
import { importArticle,importScript } from "@/lib/video-factory/intake";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>{
    const input=z.discriminatedUnion("action",[z.object({action:z.literal("article"),url:z.string().url().max(2000)}).strict(),z.object({action:z.literal("script"),text:z.string().min(10).max(30000)}).strict()]).parse(await boundedJson(req));
    return NextResponse.json(input.action==="article"?{source:await importArticle(userId,params.id,input.url)}:await importScript(userId,params.id,input.text));
  });
}
