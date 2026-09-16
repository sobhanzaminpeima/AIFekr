export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getPredictionStatus } from "@/lib/ai/replicate";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";
import { refundCredits } from "@/lib/utils/teamCredits";

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

  if ((status === "failed" || status === "canceled") && musicId) {
    // Credits were charged up-front in generate/route.ts before the async
    // job's outcome was known — refund now that it's terminally failed.
    // Same idempotency trick as video/status: `refunded: false` in the where
    // clause means repeated polls can only ever refund once.
    const { count } = await prisma.generatedMusic.updateMany({
      where: { id: musicId, userId: user.id, refunded: false },
      data: { refunded: true },
    });
    if (count > 0) {
      const music = await prisma.generatedMusic.findUnique({ where: { id: musicId }, select: { credits: true } });
      if (music) await refundCredits(user.id, music.credits);
    }
  }

  return NextResponse.json({ status, output, error });
}
