import { NextRequest } from "next/server";
import { factoryRoute } from "@/lib/video-factory/http";
import { downloadDelivery } from "@/lib/video-factory/economyDelivery";

export const dynamic = "force-dynamic";
export function GET(req: NextRequest, context: { params: Promise<{ id: string; kind: string }> }) {
  return factoryRoute(req, false, async userId => {
    const { id, kind } = await context.params;
    return downloadDelivery(userId, id, kind, req);
  });
}
