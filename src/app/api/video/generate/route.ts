export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { generateVideo } from "@/lib/ai/replicate";
import { CREDIT_COSTS } from "@/lib/utils/credits";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const { prompt, duration = 5, ratio = "16:9", style = "واقعی" } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: "توضیحات ویدیو الزامی است" }, { status: 400 });

    const creditCost = duration <= 5 ? 20 : duration <= 10 ? 35 : 80;

    if (user.credits < creditCost) {
      return NextResponse.json({ error: `اعتبار کافی ندارید. نیاز به ${creditCost} اعتبار دارید` }, { status: 402 });
    }

    if (user.plan === "FREE") {
      return NextResponse.json({ error: "تولید ویدیو برای پلن رایگان در دسترس نیست" }, { status: 402 });
    }

    const { predictionId, status } = await generateVideo({ prompt, duration: duration as any, ratio, style });

    // Deduct credits immediately
    await prisma.user.update({ where: { id: user.id }, data: { credits: { decrement: creditCost } } });

    // Save with pending status
    const video = await prisma.generatedVideo.create({
      data: {
        userId: user.id,
        prompt,
        duration,
        url: predictionId, // temporarily store predictionId as url
        credits: creditCost,
      },
    });

    await prisma.usageLog.create({
      data: { userId: user.id, type: "video", credits: creditCost, metadata: JSON.stringify({ predictionId, duration, ratio, style }) },
    });

    return NextResponse.json({ videoId: video.id, predictionId, status, credits_used: creditCost });
  } catch (err) {
    console.error("video generate error:", err);
    return NextResponse.json({ error: "خطا در تولید ویدیو" }, { status: 500 });
  }
}
