export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { generateMusic } from "@/lib/ai/replicate";

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

    const { predictionId, status } = await generateMusic({ prompt, genre, duration: duration as any });

    await prisma.user.update({ where: { id: user.id }, data: { credits: { decrement: creditCost } } });

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
      data: { userId: user.id, type: "music", credits: creditCost, metadata: JSON.stringify({ predictionId, genre, duration }) },
    });

    return NextResponse.json({ musicId: music.id, predictionId, status, credits_used: creditCost });
  } catch (err) {
    console.error("music generate error:", err);
    return NextResponse.json({ error: "خطا در تولید موزیک" }, { status: 500 });
  }
}
