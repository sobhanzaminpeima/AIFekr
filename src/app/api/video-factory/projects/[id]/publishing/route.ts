import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson,factoryRoute } from "@/lib/video-factory/http";
import { getProject } from "@/lib/video-factory/service";
import { cancelPublishing,channelState,disconnectChannel,listPublishing,savePublishingMetadata,schedulePublish } from "@/lib/video-factory/publishing";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>{await getProject(userId,params.id);return NextResponse.json({channel:await channelState(userId),jobs:await listPublishing(userId,params.id)});});
}
export async function POST(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return factoryRoute(req,false,async userId=>{
    await getProject(userId,params.id);const input=z.discriminatedUnion("action",[z.object({action:z.literal("metadata"),value:z.unknown()}).strict(),z.object({action:z.literal("schedule"),value:z.unknown()}).strict(),z.object({action:z.literal("cancel"),jobId:z.string().max(100)}).strict(),z.object({action:z.literal("disconnect")}).strict()]).parse(await boundedJson(req));
    return NextResponse.json(input.action==="metadata"?await savePublishingMetadata(userId,params.id,input.value):input.action==="schedule"?await schedulePublish(userId,params.id,input.value):input.action==="cancel"?await cancelPublishing(userId,input.jobId):await disconnectChannel(userId));
  });
}
