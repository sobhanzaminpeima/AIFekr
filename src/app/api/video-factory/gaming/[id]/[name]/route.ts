import { NextRequest } from "next/server";
import { factoryRoute } from "@/lib/video-factory/http";
import { gamingDownload } from "@/lib/video-factory/gamingShorts";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest, context: { params: Promise<{ id: string; name: string }> }) {
  return factoryRoute(req, false, async userId => {
    const { id, name } = await context.params;
    return gamingDownload(userId, id, name, req);
  });
}
