import { NextRequest, NextResponse } from "next/server";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { createGamingDraft, gamingCatalog } from "@/lib/video-factory/gamingShorts";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return factoryRoute(req, false, async userId => NextResponse.json(await gamingCatalog(userId)));
}
export function POST(req: NextRequest) {
  return factoryRoute(req, false, async userId => NextResponse.json({ order: await createGamingDraft(userId, await boundedJson(req)) }));
}
