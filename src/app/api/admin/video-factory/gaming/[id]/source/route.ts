import { NextRequest } from "next/server";
import { factoryRoute } from "@/lib/video-factory/http";
import { gamingDownload } from "@/lib/video-factory/gamingShorts";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return factoryRoute(req, true, async actorId => gamingDownload(actorId, (await context.params).id, "source.mp4", req, true));
}
