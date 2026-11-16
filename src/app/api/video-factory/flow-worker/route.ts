import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/utils/rateLimit";
import { boundedJson } from "@/lib/video-factory/http";
import { assetBytes } from "@/lib/video-factory/assets";
import { FactoryError } from "@/lib/video-factory/errors";
import { claimFlowTask, completeFlowTask, flagFlowTask, flowWorkerConfigured, startFlowTask } from "@/lib/video-factory/flowBridge";
import { flowTaskSchema, requireFlowClaim } from "@/lib/video-factory/flowProtocol";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const identity=z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/);
const claim=z.object({workerId:identity,stepId:identity,leaseToken:z.string().uuid()}).strict();
function authenticate(req:NextRequest){
  if(!flowWorkerConfigured())throw new FactoryError("FLOW_WORKER_DISABLED",503);
  const given=req.headers.get("authorization") || "";
  if(given.length>500 || !timingSafeEqual(createHash("sha256").update(given).digest(),createHash("sha256").update(`Bearer ${process.env.VIDEO_FACTORY_FLOW_WORKER_TOKEN}`).digest()))throw new FactoryError("UNAUTHORIZED",401);
  if(!rateLimit("vf-flow-worker",240,60000).allowed)throw new FactoryError("RATE_LIMITED",429);
}
export async function POST(req:NextRequest){
  try{
    authenticate(req);
    const action=req.nextUrl.searchParams.get("action");
    // Connectivity checks must not claim work, debit credits or advertise readiness.
    if(action==="health"){
      return NextResponse.json({ok:true,protocol:1,generationStarted:false},{headers:{"Cache-Control":"no-store"}});
    }
    if(action==="complete"){
      const body=claim.parse({workerId:req.headers.get("x-worker-id"),stepId:req.headers.get("x-step-id"),leaseToken:req.headers.get("x-lease-token")});
      const reader=req.body?.getReader();if(!reader)throw new FactoryError("FLOW_INVALID_IMAGE",400);
      let size=0;const chunks:Uint8Array[]=[];
      while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>20_000_000){await reader.cancel();throw new FactoryError("INPUT_TOO_LARGE",413);}chunks.push(part.value);}
      return NextResponse.json(await completeFlowTask(body.stepId,body.workerId,body.leaseToken,Buffer.concat(chunks)));
    }
    const raw=await boundedJson(req);
    if(action==="claim"){
      const {workerId}=z.object({workerId:identity}).strict().parse(raw);
      return NextResponse.json({task:await claimFlowTask(workerId)},{headers:{"Cache-Control":"no-store"}});
    }
    if(action==="start"){
      const body=claim.parse(raw);return NextResponse.json(await startFlowTask(body.stepId,body.workerId,body.leaseToken));
    }
    if(action==="blocked"){
      const body=claim.extend({code:z.enum(["LOGIN_REQUIRED","CREDITS_REQUIRED","UI_CHANGED","OUTPUT_UNCERTAIN","REFERENCE_REQUIRED","DOWNLOAD_FAILED"])}).parse(raw);
      return NextResponse.json(await flagFlowTask(body.stepId,body.workerId,body.leaseToken,body.code));
    }
    if(action==="reference"){
      const body=claim.parse(raw),step=await prisma.videoFactoryStep.findUnique({where:{id:body.stepId},include:{job:true}});
      if(!step?.providerJobId?.startsWith("flow:"))throw new FactoryError("FLOW_TASK_NOT_FOUND",404);
      const task=flowTaskSchema.parse(JSON.parse(step.output || "{}"));requireFlowClaim(task,body.workerId,body.leaseToken);
      if(!task.referenceAssetId)throw new FactoryError("ASSET_NOT_FOUND",404);
      const asset=await assetBytes(step.job.userId,task.referenceAssetId);
      if(asset.asset.kind!=="IMAGE")throw new FactoryError("MEDIA_TYPE_MISMATCH",400);
      return new NextResponse(new Uint8Array(asset.bytes),{headers:{"Content-Type":asset.asset.mimeType,"Cache-Control":"private, no-store"}});
    }
    throw new FactoryError("INVALID_INPUT",400);
  }catch(error){
    const code=error instanceof FactoryError?error.code:error instanceof z.ZodError || error instanceof SyntaxError?"INVALID_INPUT":"FLOW_WORKER_UNAVAILABLE";
    return NextResponse.json({code},{status:error instanceof FactoryError?error.status:error instanceof z.ZodError || error instanceof SyntaxError?400:503});
  }
}
