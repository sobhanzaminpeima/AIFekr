export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getPredictionStatus } from "@/lib/ai/replicate";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const predictionId = new URL(req.url).searchParams.get("predictionId");
  const videoId = new URL(req.url).searchParams.get("videoId");

  if (!predictionId) return NextResponse.json({ error: "predictionId required" }, { status: 400 });

  const { status, output, error } = await getPredictionStatus(predictionId);

  if (status === "succeeded" && output && videoId) {
    // Upload to R2 if it's a real URL
    let finalUrl = output;
    try {
      if (!output.includes("placehold.co")) {
        const res = await fetch(output);
        const buf = Buffer.from(await res.arrayBuffer());
        const key = getStorageKey(user.id, "video", `${videoId}.mp4`);
        finalUrl = await uploadToStorage(buf, key, "video/mp4");
      }
    } catch { /* keep original url */ }

    // Update video record
    await prisma.generatedVideo.updateMany({
      where: { id: videoId, userId: user.id },
      data: { url: finalUrl },
    });
  }

  return NextResponse.json({ status, output, error });
}
