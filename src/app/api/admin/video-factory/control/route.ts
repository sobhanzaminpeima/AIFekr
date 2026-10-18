import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson,factoryRoute } from "@/lib/video-factory/http";
import { saveMediaProvider,probeMediaProvider } from "@/lib/video-factory/registry";
import { saveResource,rollbackResource } from "@/lib/video-factory/resources";
import { adminAnalytics,inspectJob,changePriority,bulkControl,quarantineAsset,retentionSweep,requeueJob } from "@/lib/video-factory/operations";
import { removeAsset } from "@/lib/video-factory/assets";
import { prisma } from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,true,async id=>{
  const resourceId=req.nextUrl.searchParams.get("resourceId");if(resourceId)return NextResponse.json({history:await prisma.videoFactoryConfigVersion.findMany({where:{resourceId:resourceId.slice(0,100)},select:{id:true,kind:true,version:true,createdAt:true},orderBy:{version:"desc"},take:50})});
  return NextResponse.json(req.nextUrl.searchParams.get("jobId")?await inspectJob(id,req.nextUrl.searchParams.get("jobId")!):await adminAnalytics());
});}
const inputSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("provider.save"),value:z.unknown()}).strict(),z.object({action:z.literal("provider.probe"),id:z.string().max(100)}).strict(),
  z.object({action:z.literal("resource.save"),value:z.unknown()}).strict(),z.object({action:z.literal("resource.rollback"),id:z.string().max(100),version:z.number().int().positive(),expectedVersion:z.number().int().positive()}).strict(),
  z.object({action:z.literal("job.priority"),id:z.string().max(100),priority:z.number().int().min(-10).max(10)}).strict(),
  z.object({action:z.literal("job.requeue"),id:z.string().max(100)}).strict(),
  z.object({action:z.literal("jobs.bulk"),projectIds:z.array(z.string().max(100)).min(1).max(20),operation:z.enum(["pause","resume","cancel"]),confirmed:z.literal(true)}).strict(),
  z.object({action:z.literal("asset.quarantine"),id:z.string().max(100),reason:z.string().min(5).max(1000)}).strict(),z.object({action:z.literal("asset.delete"),id:z.string().max(100)}).strict(),
  z.object({action:z.literal("retention.run")}).strict(),
]);
export function POST(req:NextRequest){return factoryRoute(req,true,async id=>{const input=inputSchema.parse(await boundedJson(req));let result:unknown;
  switch(input.action){case "provider.save":result=await saveMediaProvider(id,input.value);break;case "provider.probe":result=await probeMediaProvider(id,input.id);break;case "resource.save":result=await saveResource(id,input.value);break;case "resource.rollback":result=await rollbackResource(id,input.id,input.version,input.expectedVersion);break;case "job.priority":result=await changePriority(id,input.id,input.priority);break;case "job.requeue":result=await requeueJob(id,input.id);break;case "jobs.bulk":result=await bulkControl(id,input.projectIds,input.operation);break;case "asset.quarantine":result=await quarantineAsset(id,input.id,input.reason);break;case "asset.delete":result=await removeAsset(id,input.id,true);break;case "retention.run":result=await retentionSweep(id);break;}
  return NextResponse.json({result});
});}
