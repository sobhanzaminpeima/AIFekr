import { NextRequest, NextResponse } from "next/server";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { getDiscount, listOrders, setDiscount, updateEconomyOrder } from "@/lib/video-factory/economyOrders";
import { deliverOrder } from "@/lib/video-factory/economyDelivery";

export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return factoryRoute(req, true, async () => {
    const [orders, discountPercent] = await Promise.all([listOrders(), getDiscount()]);
    return NextResponse.json({ orders, discountPercent }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
export function PATCH(req: NextRequest) {
  return factoryRoute(req, true, async id => {
    const input = await boundedJson(req);
    if (input && typeof input === "object" && "action" in input) return NextResponse.json({order:await updateEconomyOrder(id,input)});
    return NextResponse.json(await setDiscount(id,input));
  });
}
export function POST(req: NextRequest) {
  return factoryRoute(req, true, async id => NextResponse.json({ order: await deliverOrder(id, req) }));
}
