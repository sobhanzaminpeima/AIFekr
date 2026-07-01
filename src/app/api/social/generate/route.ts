export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { streamChat, getModelForPlan } from "@/lib/ai/claude";

const SYSTEM = `You are an elite social media strategist and copywriter with 15 years of experience growing brands to millions of followers. You understand platform algorithms, audience psychology, viral triggers, and content formats deeply. You always write in the language the user specifies (Persian/Farsi or English). Your posts are compelling, on-brand, and optimized for maximum reach and engagement.`;

const PLATFORM_GUIDES: Record<string, string> = {
  instagram: "Instagram: Hook in first 2 lines (before 'more'), 1500-2200 chars optimal, storytelling captions, 5-10 relevant hashtags (mix of popular and niche), CTA at end. Use line breaks for readability. Carousel posts get 3x reach.",
  linkedin: "LinkedIn: Professional yet personable, thought leadership, 1300 chars optimal, personal stories with business lessons perform best, 3-5 relevant hashtags, strong first line hook, end with question or CTA. Long-form performs well on weekdays.",
  twitter: "Twitter/X: Under 280 chars per tweet, hook in first 5 words, threads get more engagement (number each tweet 1/n), use 1-2 hashtags max, ask questions, contrarian takes drive retweets.",
  facebook: "Facebook: Community-focused, story-based, 100-250 chars for feed posts (longer for groups), include a question, emotional storytelling, Facebook video/reels get prioritized, native video over YouTube links.",
  tiktok: "TikTok: Script for video, strong hook in first 3 seconds (text to say OUT LOUD), trendy audio suggestions, 15-60 seconds optimal, text on screen tips, 3-5 trending hashtags, end with CTA to follow.",
};

function buildPrompt(data: {
  brandName: string; topic: string; platform: string; tone: string;
  hashtags: boolean; emojis: boolean; language?: string; industry?: string; targetAudience?: string;
}) {
  const platformGuide = PLATFORM_GUIDES[data.platform.toLowerCase()] || PLATFORM_GUIDES.instagram;
  const hashtagNote = data.hashtags ? "Include relevant hashtags." : "Do NOT include hashtags.";
  const emojiNote = data.emojis ? "Use strategic emojis for visual breaks and emotion (don't overdo it)." : "Do NOT use emojis.";
  const lang = data.language || "fa";

  return `${lang === "fa" ? "پست‌های شبکه اجتماعی بنویس به زبان فارسی." : "Write social media posts in English."}

Brand: ${data.brandName}
${data.industry ? `Industry: ${data.industry}` : ""}
${data.targetAudience ? `Target Audience: ${data.targetAudience}` : ""}
Topic/Campaign: ${data.topic}
Tone: ${data.tone}
Platform: ${data.platform}

Platform Best Practices: ${platformGuide}
${hashtagNote}
${emojiNote}

Create 3 HIGH-PERFORMING post variations. Each must be distinctly different (different angle, format, hook strategy):

## پست اول — Hook اطلاعاتی
**نوع:** آموزشی / اطلاع‌رسانی
**کپشن:**
[متن کامل پست]

**بهترین زمان انتشار:** [روز و ساعت]
**نکته بهینه‌سازی:** [یک نکته خاص برای این پلتفرم]
**ایده ویژوال:** [توضیح تصویر یا ویدیو پیشنهادی]

## پست دوم — Hook احساسی
**نوع:** داستان / احساسی
**کپشن:**
[متن کامل پست]

**بهترین زمان انتشار:** [روز و ساعت]
**نکته بهینه‌سازی:** [یک نکته خاص]
**ایده ویژوال:** [توضیح]

## پست سوم — Hook تبلیغاتی
**نوع:** ترویجی / فروش
**کپشن:**
[متن کامل پست]

**بهترین زمان انتشار:** [روز و ساعت]
**نکته بهینه‌سازی:** [یک نکته خاص]
**ایده ویژوال:** [توضیح]

## استراتژی کلی
[۲-۳ جمله درباره رویکرد کلی برای این کمپین]`;
}

function buildCalendarPrompt(data: { brandName: string; platform: string; topic: string; language?: string; industry?: string }) {
  const lang = data.language || "fa";
  return `${lang === "fa" ? "تقویم محتوایی به زبان فارسی بنویس." : "Write content calendar in English."}

Create a professional 7-day social media content calendar for:
Brand: ${data.brandName}
${data.industry ? `Industry: ${data.industry}` : ""}
Platform: ${data.platform}
Theme/Campaign: ${data.topic}

Use the 5-3-2 rule: 5 educational, 3 engagement, 2 promotional posts per 10 posts.

## تقویم محتوایی ۷ روزه — ${data.brandName}

**روز ۱ — شنبه**
- نوع محتوا: [Educational/Promotional/Engagement/UGC/Story]
- هوک (جمله اول): [دقیقاً چه بنویسد تا توجه جلب شود]
- ایده اصلی محتوا: [توضیح کامل]
- ایده ویژوال: [عکس/ویدیو/گرافیک]
- هشتگ‌های پیشنهادی: [۵-۷ هشتگ]
- بهترین زمان: [ساعت]

**روز ۲ — یکشنبه**
[همین فرمت]

[ادامه تا روز ۷]

## نکات استراتژیک هفته
[۳-۵ نکته مهم برای اجرای موفق این تقویم]`;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { type = "posts" } = body;
    const model = getModelForPlan(user.plan);

    const prompt = type === "calendar" ? buildCalendarPrompt(body) : buildPrompt(body);
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await streamChat([{ role: "user", content: prompt }], SYSTEM, model, (text) => {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          });

          if (type === "posts" && body.platform && body.topic) {
            await prisma.socialPost.create({
              data: {
                userId: user.id,
                platform: body.platform,
                topic: body.topic,
                content: fullContent,
              },
            });
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Social stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (err) {
    console.error("Social error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
