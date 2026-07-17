export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { generateVideo } from "@/lib/ai/replicate";
import { CREDIT_COSTS } from "@/lib/utils/credits";
import { getAvailableCredits, deductCredits } from "@/lib/utils/teamCredits";
import { getLimitsForPlan } from "@/lib/utils/planLimits";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const { prompt, duration = 5, ratio = "16:9", style = "واقعی" } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: "توضیحات ویدیو الزامی است" }, { status: 400 });

    const creditCost = duration <= 5 ? 20 : duration <= 10 ? 35 : 80;

    if ((await getAvailableCredits(user.id)) < creditCost) {
      return NextResponse.json({ error: `اعتبار کافی ندارید. نیاز به ${creditCost} اعتبار دارید` }, { status: 402 });
    }

    const planLimit = await getLimitsForPlan(user.plan);
    if (planLimit.monthlyVideos !== -1) {
      if (planLimit.monthlyVideos === 0) {
        return NextResponse.json({ error: "تولید ویدیو برای پلن شما در دسترس نیست" }, { status: 402 });
      }
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthlyVideos = await prisma.generatedVideo.count({ where: { userId: user.id, createdAt: { gte: monthStart } } });
      if (monthlyVideos >= planLimit.monthlyVideos) {
        return NextResponse.json({ error: `سقف ${planLimit.monthlyVideos} ویدیو ماهانهٔ پلن شما تمام شد` }, { status: 402 });
      }
    }

    const { predictionId, status } = await generateVideo({ prompt, duration: duration as any, ratio, style });

    // Deduct credits immediately
    await deductCredits(user.id, creditCost);

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
