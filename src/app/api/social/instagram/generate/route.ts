export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { routedStreamChat } from "@/lib/ai/router";

// Structured counterpart to /api/social/generate — that one streams free
// -form markdown; this returns strict JSON (caption, exactly 5 hashtags,
// best posting time) so it can be scheduled/auto-published without the
// user having to copy-paste pieces out of prose.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { businessName, businessType, topic } = await req.json();
  if (!businessName || !businessType) {
    return NextResponse.json({ error: "نام و نوع کسب‌وکار الزامی است" }, { status: 400 });
  }

  const systemPrompt = "تو استراتژیست شبکه‌های اجتماعی حرفه‌ای هستی. فقط و فقط یک JSON خام و معتبر برگردان، بدون توضیح یا markdown اضافه.";
  const userMessage = `برای کسب‌وکار «${businessName}» (نوع: ${businessType})${topic ? ` با موضوع «${topic}»` : ""} یک پست اینستاگرام جذاب و پرتعامل بساز.
خروجی دقیقاً به این فرمت JSON:
{"caption": "کپشن کامل با ایموجی مناسب", "hashtags": ["#تگ1", "#تگ2", "#تگ3", "#تگ4", "#تگ5"], "bestTime": "توضیح کوتاه فارسی از بهترین روز و ساعت انتشار برای رشد پیج (مثلاً پنجشنبه ساعت ۲۰:۰۰)"}
حتماً دقیقاً ۵ هشتگ مرتبط و پرجستجو در ایران بده.`;

  let raw = "";
  try {
    await routedStreamChat([{ role: "user", content: userMessage }], systemPrompt, (chunk) => { raw += chunk; }, () => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در ارتباط با AI: ${msg}` }, { status: 502 });
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: "پاسخ AI قابل تفسیر نبود" }, { status: 502 });

  try {
    const parsed = JSON.parse(match[0]);
    return NextResponse.json({ caption: parsed.caption, hashtags: parsed.hashtags?.slice(0, 5) || [], bestTime: parsed.bestTime });
  } catch {
    return NextResponse.json({ error: "پاسخ AI قابل تفسیر نبود" }, { status: 502 });
  }
}
