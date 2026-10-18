import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { processFactoryTick } from "@/lib/video-factory/worker";
import { processPublishTick } from "@/lib/video-factory/publishing";
import { expireHolds } from "@/lib/video-factory/operations";
import {prisma} from "@/lib/db/prisma";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try { const expired=await expireHolds();const [processed,publishProcessed]=await Promise.all([processFactoryTick(),processPublishTick()]);await prisma.siteSetting.upsert({where:{key:"videoFactoryWorkerHeartbeat"},create:{key:"videoFactoryWorkerHeartbeat",value:new Date().toISOString()},update:{value:new Date().toISOString()}});return NextResponse.json({processed,publishProcessed,expired}); }
  catch { return NextResponse.json({ code: "WORKER_UNAVAILABLE" }, { status: 503 }); }
}
