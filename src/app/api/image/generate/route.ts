export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { CREDIT_COSTS } from "@/lib/utils/credits";
import { getAvailableCredits, chargeAndLog } from "@/lib/utils/teamCredits";
import { getLimitsForPlan } from "@/lib/utils/planLimits";
import * as qwen from "@/lib/ai/qwen";
import * as openaiImage from "@/lib/ai/openaiImage";
import { isCustomProviderModel } from "@/lib/ai/customProviders";
import { generateCustomImage } from "@/lib/ai/customImageProvider";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";
import { isFeatureEnabled, FEATURE_DISABLED_MESSAGE } from "@/lib/utils/featureToggles";
import { maxReferenceImages } from "@/lib/constants/imageUploadLimits";

// OpenAI (gpt-image) is preferred when configured — real credit was purchased
// for it — with Qwen kept as the fallback path exactly as qwen.ts documents.
// The user can also explicitly pick a provider (see /api/ai/image-providers
// for what's actually configured) — an unconfigured or unknown choice falls
// back to the same default logic as before.
const defaultProvider = openaiImage.isOpenAIImageAvailable ? openaiImage : qwen;
const defaultUsageModelTag = openaiImage.isOpenAIImageAvailable ? openaiImage.openAIImageModel : undefined;

function resolveProvider(requested: string | undefined) {
  if (requested === "openai" && openaiImage.isOpenAIImageAvailable) {
    return { provider: openaiImage, usageModelTag: openaiImage.openAIImageModel };
  }
  if (requested === "qwen" && qwen.isQwenImageAvailable) {
    return { provider: qwen, usageModelTag: undefined };
  }
  return { provider: defaultProvider, usageModelTag: defaultUsageModelTag };
}

// Safety valves specific to the OpenAI provider, since it draws down a real
// dollar balance rather than the app's internal credit currency. Both are
// env-configurable — defaults are conservative estimates and should be
// tuned once real per-image cost is visible in the OpenAI usage dashboard.
const OPENAI_IMAGE_DAILY_LIMIT_PER_USER = Number(process.env.OPENAI_IMAGE_DAILY_LIMIT_PER_USER || 5);
const OPENAI_IMAGE_MONTHLY_BUDGET_CAP = Number(process.env.OPENAI_IMAGE_MONTHLY_BUDGET_CAP || 200);

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!(await isFeatureEnabled("image"))) {
    return NextResponse.json({ error: FEATURE_DISABLED_MESSAGE.image }, { status: 503 });
  }

  try {
    const { prompt, style = "realistic", ratio = "1:1", quality = "standard", count = 1, sourceImageUrl, sourceImageUrls, provider: requestedProvider, kind = "standard" } = await req.json();

    if (!prompt?.trim()) return NextResponse.json({ error: "توضیحات تصویر الزامی است" }, { status: 400 });

    // `sourceImageUrls` (plural) is the current shape -- multiple reference
    // photos in one turn, e.g. two people for a "couple" prompt.
    // `sourceImageUrl` (singular) is kept working for any older caller.
    const refUrls: string[] = Array.isArray(sourceImageUrls) && sourceImageUrls.length > 0
      ? sourceImageUrls
      : sourceImageUrl ? [sourceImageUrl] : [];

    const maxRefs = maxReferenceImages(user.plan);
    if (refUrls.length > maxRefs) {
      return NextResponse.json({ error: `پلن شما اجازهٔ حداکثر ${maxRefs} عکس مرجع را می‌دهد` }, { status: 402 });
    }

    const { provider, usageModelTag } = resolveProvider(requestedProvider);

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

    // OpenAI-specific guardrails: per-customer daily cap + a global monthly
    // cap that protects the purchased OpenAI credit balance from a runaway bill.
    if (usageModelTag) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const [dailyUserCount, monthlyGlobalCount] = await Promise.all([
        prisma.usageLog.count({ where: { userId: user.id, type: "image", model: usageModelTag, createdAt: { gte: dayStart } } }),
        prisma.usageLog.count({ where: { type: "image", model: usageModelTag, createdAt: { gte: monthStart } } }),
      ]);

      if (dailyUserCount + count > OPENAI_IMAGE_DAILY_LIMIT_PER_USER) {
        return NextResponse.json({ error: `سقف روزانه ${OPENAI_IMAGE_DAILY_LIMIT_PER_USER} تصویر با هوش مصنوعی OpenAI تمام شد` }, { status: 402 });
      }
      if (monthlyGlobalCount + count > OPENAI_IMAGE_MONTHLY_BUDGET_CAP) {
        return NextResponse.json({ error: "سقف بودجهٔ ماهانهٔ OpenAI برای تولید تصویر تمام شد" }, { status: 402 });
      }
    }

    // Image-to-image when the user uploaded a reference photo, text-to-image otherwise.
    // Admin-added custom providers (model string "custom:<id>") bypass the
    // built-in provider table entirely and go through the generic
    // OpenAI-compatible /images/generations contract in customImageProvider.ts —
    // reference-image (image-to-image) isn't part of that contract.
    const rawUrls = isCustomProviderModel(requestedProvider)
      ? await generateCustomImage(requestedProvider.slice("custom:".length), prompt, {
          n: count,
          size: ratio === "16:9" ? "1792x1024" : ratio === "9:16" ? "1024x1792" : "1024x1024",
        })
      : refUrls.length > 0
      ? await provider.generateImageFromReference({ prompt, style, ratio, count, imageUrls: refUrls })
      : quality === "hd"
      ? await provider.generateImagesHQ({ prompt, style, ratio, count })
      : await provider.generateImages({ prompt, style, ratio, count });

    // Upload to R2 storage (base64 data URI decoded directly, remote URL fetched then uploaded)
    const finalUrls = await Promise.all(
      rawUrls.map(async (url, i) => {
        try {
          // If it's already a placeholder, skip upload
          if (url.includes("placehold.co") || url.includes("picsum.photos")) return url;
          const key = getStorageKey(user.id, "image", `${i}.webp`);
          if (url.startsWith("data:")) {
            const buf = Buffer.from(url.split(",")[1] || "", "base64");
            return await uploadToStorage(buf, key, "image/webp");
          }
          const res = await fetch(url);
          const buf = Buffer.from(await res.arrayBuffer());
          return await uploadToStorage(buf, key, "image/webp");
        } catch {
          return url; // fallback to original URL
        }
      })
    );

    // Charge + usage row in one transaction. The images are already
    // generated at this point, so a declined charge here means a concurrent
    // request drained the balance after this one's pre-flight check —
    // surface it rather than handing over free generations.
    const charged = await chargeAndLog(user.id, creditCost, {
      type: "image",
      model: usageModelTag,
      metadata: { style, ratio, quality, count },
    });
    if (!charged) {
      return NextResponse.json({ error: "اعتبار کافی ندارید" }, { status: 402 });
    }

    const saved = await Promise.all(
      finalUrls.map(url =>
        prisma.generatedImage.create({
          // GeneratedImage only has one sourceImageUrl column (predates
          // multi-reference support) -- first reference photo is stored for
          // the gallery preview; the full set matters only at generation
          // time, not afterward.
          data: { userId: user.id, prompt, style, url, sourceImageUrl: refUrls[0] || null, credits: Math.round(creditCost / count), kind: kind === "character_sheet" ? "character_sheet" : "standard" },
        })
      )
    );

    return NextResponse.json({ images: saved, credits_used: creditCost });
  } catch (err) {
    console.error("image generate error:", err);
    return NextResponse.json({ error: "خطا در تولید تصویر" }, { status: 500 });
  }
}
