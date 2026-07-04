export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { generateMusic } from "@/lib/ai/replicate";
import { generateMusicElevenLabs } from "@/lib/ai/elevenlabs";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const { prompt, genre = "pop", duration = 30 } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: "توضیحات موزیک الزامی است" }, { status: 400 });

    const creditCost = duration <= 30 ? 10 : duration <= 60 ? 18 : 30;

    if (user.credits < creditCost) {
      return NextResponse.json({ error: `اعتبار کافی ندارید. نیاز به ${creditCost} اعتبار دارید` }, { status: 402 });
    }

    if (user.plan === "FREE") {
      return NextResponse.json({ error: "تولید موزیک برای پلن رایگان در دسترس نیست" }, { status: 402 });
    }

    // ElevenLabs returns finished audio synchronously — try it first when
    // configured, since it needs no webhook/polling round-trip. Falls back
    // to the existing Replicate (async prediction) path on any failure.
    const fullPrompt = genre ? `${genre} music, ${prompt}` : prompt;
    let elevenLabsResult: Awaited<ReturnType<typeof generateMusicElevenLabs>> = null;
    try {
      elevenLabsResult = await generateMusicElevenLabs({ prompt: fullPrompt, durationMs: duration * 1000 });
    } catch (err) {
      console.warn("ElevenLabs music generation failed, falling back to Replicate:", err);
    }

    await prisma.user.update({ where: { id: user.id }, data: { credits: { decrement: creditCost } } });

    if (elevenLabsResult) {
      const music = await prisma.generatedMusic.create({
        data: { userId: user.id, prompt, genre, duration, url: "", credits: creditCost },
      });

      const key = getStorageKey(user.id, "music", `${music.id}.mp3`);
      const finalUrl = await uploadToStorage(elevenLabsResult.buffer, key, elevenLabsResult.contentType);

      await prisma.generatedMusic.update({ where: { id: music.id }, data: { url: finalUrl } });
      await prisma.usageLog.create({
        data: { userId: user.id, type: "music", credits: creditCost, metadata: JSON.stringify({ provider: "elevenlabs", genre, duration }) },
      });

      return NextResponse.json({ musicId: music.id, status: "succeeded", output: finalUrl, credits_used: creditCost });
    }

    const { predictionId, status } = await generateMusic({ prompt, genre, duration: duration as any });

    const music = await prisma.generatedMusic.create({
      data: {
        userId: user.id,
        prompt,
        genre,
        duration,
        url: predictionId,
        credits: creditCost,
      },
    });

    await prisma.usageLog.create({
      data: { userId: user.id, type: "music", credits: creditCost, metadata: JSON.stringify({ provider: "replicate", predictionId, genre, duration }) },
    });

    return NextResponse.json({ musicId: music.id, predictionId, status, credits_used: creditCost });
  } catch (err) {
    console.error("music generate error:", err);
    return NextResponse.json({ error: "خطا در تولید موزیک" }, { status: 500 });
  }
}
