export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getPredictionStatus } from "@/lib/ai/replicate";
import { getQwenTaskStatus } from "@/lib/ai/qwen";
import { getCustomVideoStatus } from "@/lib/ai/customVideoProvider";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";
import { refundCredits } from "@/lib/utils/teamCredits";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const predictionId = new URL(req.url).searchParams.get("predictionId");
  const videoId = new URL(req.url).searchParams.get("videoId");

  if (!predictionId) return NextResponse.json({ error: "predictionId required" }, { status: 400 });

  // Qwen (DashScope) task ids are prefixed "qwen:" at creation time (see
  // generateVideo in qwen.ts) so they can be told apart from a Replicate
  // prediction id — both are otherwise opaque strings. Custom-provider job
  // ids are prefixed "custom:<providerId>:<jobId>" the same way (see
  // startCustomVideoJob in customVideoProvider.ts).
  let statusResult: { status: string; output: unknown; error?: unknown };
  if (predictionId.startsWith("qwen:")) {
    statusResult = await getQwenTaskStatus(predictionId.slice("qwen:".length));
  } else if (predictionId.startsWith("custom:")) {
    const [, providerId, ...jobIdParts] = predictionId.split(":");
    statusResult = await getCustomVideoStatus(providerId, jobIdParts.join(":"));
  } else {
    statusResult = await getPredictionStatus(predictionId);
  }
  const status = statusResult.status;
  const output = (statusResult.output as string | null) ?? null;
  const error = statusResult.error as string | undefined;

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
  } else if ((status === "failed" || status === "canceled") && videoId) {
    // Credits were deducted up-front in generate/route.ts before the async
    // job's outcome was known — refund now that it's terminally failed.
    // `updateMany` with `refunded: false` in the where clause makes this
    // atomic-enough to avoid double-refunding on repeated status polls.
    const { count } = await prisma.generatedVideo.updateMany({
      where: { id: videoId, userId: user.id, refunded: false },
      data: { refunded: true },
    });
    if (count > 0) {
      const video = await prisma.generatedVideo.findUnique({ where: { id: videoId }, select: { credits: true } });
      if (video) await refundCredits(user.id, video.credits);
    }
  }

  return NextResponse.json({ status, output, error });
}
