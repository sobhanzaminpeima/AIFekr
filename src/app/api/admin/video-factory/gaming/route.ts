import { NextRequest, NextResponse } from "next/server";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { deliverGamingOrder, gamingAdminAction, gamingAdminOrders } from "@/lib/video-factory/gamingShorts";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
export function GET(req: NextRequest) {
  return factoryRoute(req, true, async () => NextResponse.json({ orders: await gamingAdminOrders() }));
}
export function PATCH(req: NextRequest) {
  return factoryRoute(req, true, async actorId => NextResponse.json({ order: await gamingAdminAction(actorId, await boundedJson(req)) }));
}
export function POST(req: NextRequest) {
  return factoryRoute(req, true, async actorId => {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    return NextResponse.json({ order: await deliverGamingOrder(actorId, id, req) });
  });
}
