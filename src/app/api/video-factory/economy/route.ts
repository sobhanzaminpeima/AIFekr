import { NextRequest, NextResponse } from "next/server";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { listOrders, economyQuote, placeOrder } from "@/lib/video-factory/economyOrders";

export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return factoryRoute(req, false, async userId => {
    const [orders, quote] = await Promise.all([listOrders(userId), economyQuote(userId)]);
    return NextResponse.json({ orders, quote }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
export function POST(req: NextRequest) {
  return factoryRoute(req, false, async userId => NextResponse.json({ order: await placeOrder(userId, await boundedJson(req)) }, { status: 201 }));
}
