import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { importGeneratedImage } from "@/lib/video-factory/assets";

export const dynamic = "force-dynamic";
const body = z.object({ projectId: z.string().min(1).max(100), generatedImageId: z.string().min(1).max(100) }).strict();

/** POST {projectId, generatedImageId}: copies one of the owner's AIFekr images into the project. */
export function POST(req: NextRequest) {
  return factoryRoute(req, false, async (userId) => {
    const input = body.parse(await boundedJson(req));
    return NextResponse.json({ asset: await importGeneratedImage(userId, input.projectId, input.generatedImageId) }, { status: 201 });
  });
}
