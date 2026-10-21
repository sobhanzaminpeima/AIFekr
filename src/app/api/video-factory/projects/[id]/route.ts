import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { controlJob, editManifest, estimateProject, getProject, startProject,updateProjectConfiguration } from "@/lib/video-factory/service";
export const dynamic = "force-dynamic";
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("estimate") }).strict(),
  z.object({action:z.literal("configuration"),expectedVersion:z.number().int().nonnegative(),configuration:z.unknown()}).strict(),
  z.object({ action: z.literal("start"), idempotencyKey: z.string().min(8).max(100), expectedCredits: z.number().int().min(1).max(1000000) }).strict(),
  z.object({ action: z.enum(["pause", "resume", "cancel", "approve"]) }).strict(),
  z.object({ action: z.literal("edit"), expectedVersion: z.number().int().min(0), manifest: z.unknown(),configuration:z.unknown().optional() }).strict(),
]);
export function GET(req: NextRequest, { params }: { params: { id: string } }) { return factoryRoute(req, false, async userId => NextResponse.json({ project: await getProject(userId, params.id) }, { headers: { "Cache-Control": "no-store" } })); }
export function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return factoryRoute(req, false, async userId => {
    const input = actionSchema.parse(await boundedJson(req));
    if (input.action === "estimate") return NextResponse.json({ estimate: await estimateProject(userId, params.id) });
    if(input.action==="configuration")return NextResponse.json(await updateProjectConfiguration(userId,params.id,input.expectedVersion,input.configuration));
    if (input.action === "start") return NextResponse.json({ job: await startProject(userId, params.id, input.idempotencyKey, input.expectedCredits) }, { status: 202 });
    if (input.action === "edit") return NextResponse.json(await editManifest(userId, params.id, input.expectedVersion, input.manifest,input.configuration));
    return NextResponse.json(await controlJob(userId, params.id, input.action));
  });
}
