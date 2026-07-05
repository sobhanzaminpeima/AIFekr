export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { routedStreamChat } from "@/lib/ai/router";

// Structured counterpart to /api/seo/analyze — that endpoint streams a free
// -form markdown report; this one asks for strict JSON so the "اعمال خودکار"
// button has concrete title/metaDescription values to actually write back
// to the site instead of parsing them out of prose.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { url, targetKeyword } = await req.json();
  if (!url) return NextResponse.json({ error: "آدرس الزامی است" }, { status: 400 });

  const systemPrompt = "تو متخصص سئو هستی. فقط و فقط یک JSON خام و معتبر برگردان، بدون توضیح اضافه یا markdown.";
  const userMessage = `برای صفحه‌ی ${url}${targetKeyword ? ` با کلمه کلیدی هدف "${targetKeyword}"` : ""}، بهترین Title Tag (حداکثر ۶۰ کاراکتر) و Meta Description (حداکثر ۱۶۰ کاراکتر) را پیشنهاد بده.\nفرمت خروجی دقیقاً: {"title": "...", "metaDescription": "..."}`;

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
    return NextResponse.json({ title: parsed.title, metaDescription: parsed.metaDescription });
  } catch {
    return NextResponse.json({ error: "پاسخ AI قابل تفسیر نبود" }, { status: 502 });
  }
}
