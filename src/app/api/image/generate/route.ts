export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { CREDIT_COSTS } from "@/lib/utils/credits";
import { getAvailableCredits, deductCredits } from "@/lib/utils/teamCredits";
import { getLimitsForPlan } from "@/lib/utils/planLimits";
import { generateImages, generateImagesHQ } from "@/lib/ai/fal";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const { prompt, style = "realistic", ratio = "1:1", quality = "standard", count = 1 } = await req.json();

    if (!prompt?.trim()) return NextResponse.json({ error: "توضیحات تصویر الزامی است" }, { status: 400 });

    const creditCost = (quality === "hd" ? CREDIT_COSTS.image_hd : CREDIT_COSTS.image_standard) * count;

    if ((await getAvailableCredits(user.id)) < creditCost) {
      return NextResponse.json({ error: `اعتبار کافی ندارید. نیاز به ${creditCost} اعتبار دارید` }, { status: 402 });
    }

    // Check monthly limit for the user's plan (admin-editable, /admin/usage — -1 means unlimited)
    const planLimit = await getLimitsForPlan(user.plan);
    if (planLimit.monthlyImages !== -1) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthlyImages = await prisma.generatedImage.count({ where: { userId: user.id, createdAt: { gte: monthStart } } });
      if (monthlyImages >= planLimit.monthlyImages) {
        return NextResponse.json({ error: `سقف ${planLimit.monthlyImages} تصویر ماهانهٔ پلن شما تمام شد` }, { status: 402 });
      }
    }

    // Generate via fal.ai
    const rawUrls = quality === "hd"
      ? await generateImagesHQ({ prompt, style, ratio, count })
      : await generateImages({ prompt, style, ratio, count });

    // Upload to R2 storage (fetch remote → upload)
    const finalUrls = await Promise.all(
      rawUrls.map(async (url, i) => {
        try {
          // If it's already a placeholder, skip upload
          if (url.includes("placehold.co") || url.includes("picsum.photos")) return url;
          const res = await fetch(url);
          const buf = Buffer.from(await res.arrayBuffer());
          const key = getStorageKey(user.id, "image", `${i}.webp`);
          return await uploadToStorage(buf, key, "image/webp");
        } catch {
          return url; // fallback to original URL
        }
      })
    );

    // Deduct credits + save
    await deductCredits(user.id, creditCost);

    const saved = await Promise.all(
      finalUrls.map(url =>
        prisma.generatedImage.create({
          data: { userId: user.id, prompt, style, url, credits: Math.round(creditCost / count) },
        })
      )
    );

    await prisma.usageLog.create({
      data: { userId: user.id, type: "image", credits: creditCost, metadata: JSON.stringify({ style, ratio, quality, count }) },
    });

    return NextResponse.json({ images: saved, credits_used: creditCost });
  } catch (err) {
    console.error("image generate error:", err);
    return NextResponse.json({ error: "خطا در تولید تصویر" }, { status: 500 });
  }
}
