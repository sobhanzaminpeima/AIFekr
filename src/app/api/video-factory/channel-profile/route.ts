import { NextRequest, NextResponse } from "next/server";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { getChannelProfile, saveChannelProfile } from "@/lib/video-factory/channelProfile";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return factoryRoute(req, false, async (userId) => NextResponse.json({ profile: await getChannelProfile(userId) }));
}

export function PUT(req: NextRequest) {
  return factoryRoute(req, false, async (userId) => NextResponse.json({ profile: await saveChannelProfile(userId, await boundedJson(req)) }));
}
