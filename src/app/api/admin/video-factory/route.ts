import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { adminOverview, controlJob } from "@/lib/video-factory/service";
import { savePolicy } from "@/lib/video-factory/config";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) { return factoryRoute(req, true, async () => NextResponse.json(await adminOverview(Math.floor(Math.max(0, Math.min(10000, Number(req.nextUrl.searchParams.get("page")) || 0)))))); }
export function PUT(req: NextRequest) { return factoryRoute(req, true, async id => NextResponse.json({ policy: await savePolicy(id, await boundedJson(req)) })); }
export function POST(req: NextRequest) {
  return factoryRoute(req, true, async id => {
    const input = z.object({ projectId: z.string().min(1).max(100), action: z.enum(["pause", "resume", "cancel", "approve"]) }).strict().parse(await boundedJson(req));
    return NextResponse.json(await controlJob(id, input.projectId, input.action, true));
  });
}
