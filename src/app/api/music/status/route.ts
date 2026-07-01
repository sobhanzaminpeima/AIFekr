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
  const musicId = new URL(req.url).searchParams.get("musicId");

  if (!predictionId) return NextResponse.json({ error: "predictionId required" }, { status: 400 });

  const { status, output, error } = await getPredictionStatus(predictionId);

  if (status === "succeeded" && output && musicId) {
    let finalUrl = Array.isArray(output) ? output[0] : output;
    try {
      if (!finalUrl.includes("placehold.co")) {
        const res = await fetch(finalUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const key = getStorageKey(user.id, "music", `${musicId}.mp3`);
        finalUrl = await uploadToStorage(buf, key, "audio/mpeg");
      }
    } catch { /* keep original */ }

    await prisma.generatedMusic.updateMany({
      where: { id: musicId, userId: user.id },
      data: { url: finalUrl },
    });

    return NextResponse.json({ status, output: finalUrl });
  }

  return NextResponse.json({ status, output, error });
}
