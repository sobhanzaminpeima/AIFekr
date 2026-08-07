export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { PROVIDERS } from "@/lib/ai/providers";

/**
 * Vision analysis for "recreate this post" — takes a URL to a reference
 * Instagram post image the user already made, and asks a vision-capable
 * model to (a) describe its style/composition well enough to regenerate a
 * similar image, and (b) draft a caption/hashtags matching that style.
 * Uses Gemini directly (not the text-only router) since it's the only
 * enabled provider whose model actually accepts image input.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { imageUrl, businessName, businessType, language } = await req.json();
  if (!imageUrl) return NextResponse.json({ error: "تصویر الزامی است" }, { status: 400 });

  const gemini = PROVIDERS.find((p) => p.id === "gemini");
  if (!gemini || gemini.apiKey.length < 10) {
    return NextResponse.json({ error: "سرویس تحلیل تصویر در دسترس نیست" }, { status: 503 });
  }

  const lang = language === "en" ? "en" : "fa";
  const instruction = lang === "en"
    ? `Look at this Instagram post image from the business "${businessName || "this business"}" (${businessType || "general"}). Return ONLY a raw JSON object, no markdown, no explanation:
{"styleDescription": "2-3 sentences describing the visual style, composition, colors, lighting, and subject matter", "imagePrompt": "a detailed AI image-generation prompt (in English, for a text-to-image model) that would recreate a NEW image in the same visual style and theme — not identical, just matching style", "caption": "a full Instagram caption matching this post's style, with fitting emojis", "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"]}`
    : `به این عکس پست اینستاگرام کسب‌وکار «${businessName || "این کسب‌وکار"}» (${businessType || "عمومی"}) نگاه کن. فقط و فقط یک JSON خام برگردان، بدون markdown یا توضیح:
{"styleDescription": "۲-۳ جمله فارسی که سبک بصری، ترکیب‌بندی، رنگ‌ها، نورپردازی و موضوع عکس رو توصیف کنه", "imagePrompt": "یک پرامپت دقیق تولید تصویر (به انگلیسی، برای مدل تصویرساز) که یک تصویر جدید با همون سبک بصری و تم بسازه — نه عین همون عکس، فقط سبک مشابه", "caption": "یک کپشن کامل اینستاگرام هماهنگ با سبک این پست، با ایموجی مناسب", "hashtags": ["#تگ1","#تگ2","#تگ3","#تگ4","#تگ5"]}`;

  try {
    const res = await fetch(`${gemini.baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gemini.apiKey}` },
      body: JSON.stringify({
        model: gemini.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `خطا در تحلیل تصویر: ${errText.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "پاسخ تحلیل قابل تفسیر نبود" }, { status: 502 });

    const parsed = JSON.parse(match[0]);
    return NextResponse.json({
      styleDescription: parsed.styleDescription || "",
      imagePrompt: parsed.imagePrompt || "",
      caption: parsed.caption || "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 5) : [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در تحلیل تصویر: ${msg}` }, { status: 502 });
  }
}
