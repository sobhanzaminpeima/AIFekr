export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id: predictionId, status, output } = body;

    if (status !== "succeeded" || !output) return NextResponse.json({ ok: true });

    const outputUrl = Array.isArray(output) ? output[0] : output;

    // Check if this is a video
    const video = await prisma.generatedVideo.findFirst({
      where: { url: predictionId },
    });

    if (video) {
      let finalUrl = outputUrl;
      try {
        const res = await fetch(outputUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const key = getStorageKey(video.userId, "video", `${video.id}.mp4`);
        finalUrl = await uploadToStorage(buf, key, "video/mp4");
      } catch { /* use original */ }

      await prisma.generatedVideo.update({ where: { id: video.id }, data: { url: finalUrl } });
      return NextResponse.json({ ok: true });
    }

    // Check if this is music
    const music = await prisma.generatedMusic.findFirst({
      where: { url: predictionId },
    });

    if (music) {
      let finalUrl = outputUrl;
      try {
        const res = await fetch(outputUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const key = getStorageKey(music.userId, "music", `${music.id}.mp3`);
        finalUrl = await uploadToStorage(buf, key, "audio/mpeg");
      } catch { /* use original */ }

      await prisma.generatedMusic.update({ where: { id: music.id }, data: { url: finalUrl } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: true }); // Always 200 to prevent retries
  }
}
