export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { streamChat } from "@/lib/ai/claude";

async function crawlUrl(url: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    const getTag = (p: RegExp) => { const m = html.match(p); return m ? m[1]?.trim() || "" : ""; };

    const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);
    const metaDesc = getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const canonical = getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    const ogTitle = getTag(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    const ogDesc = getTag(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
    const robots = getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);

    const h1s = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/gi)].map(m => m[1].trim()).filter(Boolean);
    const h2s = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/gi)].map(m => m[1].trim()).filter(Boolean);
    const images = (html.match(/<img[^>]*>/gi) || []).length;
    const imagesWithAlt = (html.match(/<img[^>]*alt=["'][^"']+["'][^>]*>/gi) || []).length;
    const links = (html.match(/<a[^>]*href/gi) || []).length;
    const textContent = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const wordCount = textContent.split(/\s+/).filter(Boolean).length;
    const hasSchema = html.includes("application/ld+json");

    return { title, metaDesc, h1: h1s.slice(0, 5), h2: h2s.slice(0, 10), images, imagesWithAlt, links, canonical, ogTitle, ogDesc, robots, wordCount, hasSchema };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { tool, keyword, content, url, targetKeyword, language } = await req.json();
  const lang = language || "fa";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));

      let systemPrompt = "";
      let userMessage = "";

      if (tool === "url" && url) {
        send(lang === "fa" ? "🔍 در حال بارگذاری وبسایت...\n" : "🔍 Loading website...\n");
        const data = await crawlUrl(url);

        if (!data) {
          send(lang === "fa" ? "❌ خطا در بارگذاری URL. لطفاً URL معتبر وارد کنید.\n" : "❌ Failed to load URL. Please enter a valid URL.\n");
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        send(lang === "fa" ? "✅ وبسایت بارگذاری شد. در حال تحلیل سئو...\n\n---\n\n" : "✅ Website loaded. Analyzing SEO...\n\n---\n\n");

        systemPrompt = lang === "fa"
          ? "تو یک متخصص سئو حرفه‌ای با بیش از ۱۰ سال تجربه هستی. گزارش جامع، دقیق و عملی سئو ارائه می‌دهی."
          : "You are a professional SEO specialist with 10+ years of experience. You provide comprehensive, accurate and actionable SEO reports.";

        userMessage = lang === "fa"
          ? `تحلیل کامل سئو برای: **${url}**

**داده‌های استخراج‌شده از وبسایت:**
| فیلد | مقدار |
|------|-------|
| Title | ${data.title || "❌ وجود ندارد"} |
| Title Length | ${data.title.length} کاراکتر |
| Meta Description | ${data.metaDesc || "❌ وجود ندارد"} |
| Meta Desc Length | ${data.metaDesc.length} کاراکتر |
| H1 Tags | ${data.h1.length > 0 ? data.h1.join(" / ") : "❌ وجود ندارد"} |
| H2 Tags | ${data.h2.slice(0, 5).join(" / ") || "❌ وجود ندارد"} |
| تعداد تصاویر | ${data.images} (${data.imagesWithAlt} دارای alt) |
| تعداد لینک‌ها | ${data.links} |
| تعداد کلمات | ~${data.wordCount} |
| Canonical | ${data.canonical || "❌ ندارد"} |
| OG Title | ${data.ogTitle || "❌ ندارد"} |
| OG Description | ${data.ogDesc || "❌ ندارد"} |
| Robots Meta | ${data.robots || "پیش‌فرض"} |
| Schema.org | ${data.hasSchema ? "✅ دارد" : "❌ ندارد"} |
${targetKeyword ? `| کلمه کلیدی هدف | ${targetKeyword} |` : ""}

**گزارش جامع شامل:**

### ۱. امتیاز کلی سئو (از ۱۰۰)
[امتیاز را بده و توضیح بده چرا]

### ۲. مشکلات بحرانی 🔴
[مشکلاتی که باید فوری رفع شوند]

### ۳. مشکلات متوسط 🟡
[اولویت دوم]

### ۴. نقاط قوت ✅
[چه چیزهایی درست است]

### ۵. Title بهینه پیشنهادی
[۳ نمونه title بهینه - هر کدام حداکثر ۶۰ کاراکتر]

### ۶. Meta Description پیشنهادی
[۲ نمونه - هر کدام حداکثر ۱۶۰ کاراکتر]

### ۷. کلمات کلیدی پیشنهادی
[۱۰ کلمه کلیدی مرتبط]

### ۸. برنامه عملی بهبود
[۵ اقدام اولویت‌دار برای بهبود سئو]`
          : `Full SEO analysis for: **${url}**

**Extracted website data:**
- Title: ${data.title || "❌ Missing"} (${data.title.length} chars)
- Meta Description: ${data.metaDesc || "❌ Missing"} (${data.metaDesc.length} chars)
- H1: ${data.h1.join(" / ") || "❌ Missing"}
- H2s: ${data.h2.slice(0, 5).join(" / ") || "❌ Missing"}
- Images: ${data.images} (${data.imagesWithAlt} with alt)
- Links: ${data.links}
- Word count: ~${data.wordCount}
- Canonical: ${data.canonical || "❌ Missing"}
- OG Tags: ${data.ogTitle ? "✅" : "❌ Missing"}
- Schema.org: ${data.hasSchema ? "✅" : "❌ Missing"}
${targetKeyword ? `- Target keyword: ${targetKeyword}` : ""}

**Comprehensive report including:**
1. Overall SEO score (out of 100) with explanation
2. Critical issues (fix immediately) 🔴
3. Medium priority issues 🟡
4. Strengths ✅
5. 3 optimized Title suggestions (max 60 chars each)
6. 2 Meta Description suggestions (max 160 chars each)
7. 10 suggested keywords
8. 5-step action plan for SEO improvement`;

      } else if (tool === "keyword") {
        systemPrompt = lang === "fa"
          ? "تو یک متخصص تحقیق کلمات کلیدی برای بازار ایران و فارسی‌زبان هستی."
          : "You are a keyword research specialist for Persian/Iranian market.";
        userMessage = lang === "fa"
          ? `تحقیق کلمات کلیدی برای: **"${keyword}"**\n\nارائه بده:\n1. ۲۰ کلمه کلیدی مرتبط با جدول کامل (رقابت: بالا/متوسط/پایین، حجم جستجو، نیت کاربر)\n2. ۵ کلمه کلیدی long-tail با رقابت کم\n3. ۳ کلمه کلیدی LSI (مترادف و مرتبط)\n4. سوالاتی که کاربران می‌پرسند (People Also Ask)\n5. استراتژی کلی برای این کلمه کلیدی`
          : `Keyword research for: **"${keyword}"**\n\nProvide:\n1. 20 related keywords with full table (competition, search volume, user intent)\n2. 5 long-tail keywords with low competition\n3. 3 LSI keywords\n4. Common questions users ask (People Also Ask)\n5. Overall strategy for this keyword`;

      } else if (tool === "content") {
        systemPrompt = lang === "fa"
          ? "تو یک متخصص بهینه‌سازی محتوا برای موتورهای جستجو هستی. محتوا را بهینه و طبیعی نگه می‌داری."
          : "You are a content SEO optimization specialist. You optimize content while keeping it natural.";
        userMessage = lang === "fa"
          ? `بهینه‌سازی محتوا برای کلمه کلیدی **"${keyword}"**:\n\n${content}\n\n**ارائه بده:**\n1. نسخه بهینه‌شده (تراکم کلمه کلیدی ۱-۳٪)\n2. پیشنهاد Heading Structure (H1, H2, H3)\n3. نقاط بهبود readability\n4. کلمات کلیدی LSI که باید اضافه شوند`
          : `Content optimization for keyword **"${keyword}"**:\n\n${content}\n\n**Provide:**\n1. Optimized version (keyword density 1-3%)\n2. Heading structure suggestion (H1, H2, H3)\n3. Readability improvements\n4. LSI keywords to add`;

      } else if (tool === "meta") {
        systemPrompt = lang === "fa"
          ? "تو یک متخصص نوشتن meta tags برای سئو هستی. متاهای جذاب، دقیق و بهینه می‌نویسی."
          : "You are a meta tags writing specialist. You write compelling, accurate and optimized meta tags.";
        userMessage = lang === "fa"
          ? `نوشتن Meta Tags برای:\n\n**کلمه کلیدی:** ${keyword}\n**محتوا:** ${content}\n\n**ارائه بده:**\n1. ۳ نمونه Title Tag (هر کدام حداکثر ۶۰ کاراکتر) - شامل عدد یا قدرت‌کلمه باشد\n2. ۳ نمونه Meta Description (هر کدام حداکثر ۱۶۰ کاراکتر) - با CTA\n3. ۲ نمونه OG Title و OG Description\n4. Schema markup پیشنهادی (اگر مناسب است)`
          : `Write Meta Tags for:\n\n**Keyword:** ${keyword}\n**Content:** ${content}\n\n**Provide:**\n1. 3 Title Tag examples (max 60 chars each) - include numbers or power words\n2. 3 Meta Description examples (max 160 chars each) - with CTA\n3. 2 OG Title and OG Description examples\n4. Suggested Schema markup (if applicable)`;
      }

      try {
        await streamChat(
          [{ role: "user", content: userMessage }],
          systemPrompt,
          "claude-sonnet-4-5",
          (chunk) => send(chunk)
        );
      } catch {
        send("\n\n❌ خطا در ارتباط با AI");
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
