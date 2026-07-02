export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";

const SYSTEM = `شما یک استراتژیست شبکه‌های اجتماعی حرفه‌ای هستید. پست‌های جذاب، ویروسی و بهینه برای هر پلتفرم می‌نویسید. پاسخ‌ها را به زبانی که کاربر مشخص می‌کند بنویسید.`;

function buildPrompt(data: { brandName: string; topic: string; platform: string; tone: string; hashtags: boolean; emojis: boolean; language?: string; industry?: string; targetAudience?: string }) {
  const lang = data.language || "fa";
  const hashNote = data.hashtags ? "هشتگ مرتبط اضافه کن." : "هشتگ اضافه نکن.";
  const emojiNote = data.emojis ? "از ایموجی مناسب استفاده کن." : "ایموجی استفاده نکن.";
  return `${lang === "fa" ? "پست شبکه اجتماعی به فارسی بنویس." : "Write social media post in English."}

برند: ${data.brandName}
${data.industry ? `صنعت: ${data.industry}` : ""}
${data.targetAudience ? `مخاطبان: ${data.targetAudience}` : ""}
موضوع: ${data.topic}
لحن: ${data.tone}
پلتفرم: ${data.platform}
${hashNote} ${emojiNote}

۳ پست متمایز و حرفه‌ای بنویس:

## پست اول — آموزشی/اطلاع‌رسانی
**متن:**
[متن کامل پست]
**بهترین زمان:** [روز، ساعت]
**ایده تصویر/ویدیو:** [توضیح دقیق محتوای بصری]
${data.hashtags ? "**هشتگ‌ها:** [هشتگ‌ها]" : ""}

## پست دوم — احساسی/داستانی
**متن:**
[متن کامل پست]
**بهترین زمان:** [روز، ساعت]
**ایده تصویر/ویدیو:** [توضیح دقیق محتوای بصری]
${data.hashtags ? "**هشتگ‌ها:** [هشتگ‌ها]" : ""}

## پست سوم — ترویجی/فروش
**متن:**
[متن کامل پست]
**بهترین زمان:** [روز، ساعت]
**ایده تصویر/ویدیو:** [توضیح دقیق محتوای بصری]
${data.hashtags ? "**هشتگ‌ها:** [هشتگ‌ها]" : ""}

## استراتژی کمپین
[۳-۴ جمله استراتژی کلی]`;
}

function buildCalendarPrompt(data: { brandName: string; platform: string; topic: string; language?: string; industry?: string }) {
  const lang = data.language || "fa";
  return `${lang === "fa" ? "تقویم محتوایی ۷ روزه به فارسی بنویس." : "Write 7-day content calendar in English."}

برند: ${data.brandName}
${data.industry ? `صنعت: ${data.industry}` : ""}
پلتفرم: ${data.platform}
موضوع: ${data.topic}

## تقویم محتوایی ۷ روزه — ${data.brandName}

**روز ۱ — شنبه**
- نوع: [آموزشی/احساسی/تبلیغاتی/تعاملی]
- هوک (جمله اول جذاب): [دقیق بنویس]
- ایده اصلی محتوا: [توضیح کامل]
- ایده بصری: [عکس/ویدیو/گرافیک - توضیح دقیق]
- هشتگ‌ها: [۵-۷ هشتگ]
- بهترین زمان: [ساعت دقیق]

**روز ۲ — یکشنبه**
[همین قالب]

**روز ۳ — دوشنبه**
[همین قالب]

**روز ۴ — سه‌شنبه**
[همین قالب]

**روز ۵ — چهارشنبه**
[همین قالب]

**روز ۶ — پنجشنبه**
[همین قالب]

**روز ۷ — جمعه**
[همین قالب]

## نکات اجرایی
[۵ نکته کلیدی برای اجرای موفق این تقویم]`;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { type = "posts" } = body;
    const prompt = type === "calendar" ? buildCalendarPrompt(body) : buildPrompt(body);
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await routedStreamChat([{ role: "user", content: prompt }], SYSTEM, (text) => {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }, (_p) => {});

          if (type === "posts" && body.platform && body.topic) {
            await prisma.socialPost.create({ data: { userId: user.id, platform: body.platform, topic: body.topic, content: fullContent } });
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "خطا";
          console.error("Social stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}