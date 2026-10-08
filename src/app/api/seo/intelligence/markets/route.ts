export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getSeoMarkets } from "@/lib/seo/intelligence/markets";
export async function GET(req: NextRequest) {
  if (!await requireAuth(req)) return unauthorizedResponse(req);
  try { return NextResponse.json({ markets: await getSeoMarkets(req.nextUrl.searchParams.get("kind") === "ai" ? "ai" : "labs") }); }
  catch { return NextResponse.json({ code: "MARKETS_UNAVAILABLE" }, { status: 503 }); }
}
