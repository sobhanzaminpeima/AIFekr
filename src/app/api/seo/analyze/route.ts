export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { routedStreamChat } from "@/lib/ai/router";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";
import { withToolCredits } from "@/lib/utils/withToolCredits";

/**
 * Every prompt below branches only on `lang === "fa"`, so German fell into the
 * English branch -- and neither branch ever told the model which language to
 * ANSWER in. A German user got German keywords with Persian explanations
 * around them (QA 2026-09-15, U08). Appended to every system prompt here for
 * the same reason the support assistant names its language outright: an
 * unstated output language is one the model picks from context.
 */
function outputLanguageRule(lang: Lang): string {
  return tri(
    lang,
    "\n\nکل پاسخت را فقط و فقط به زبان فارسی بنویس.",
    "\n\nWrite your ENTIRE answer in English only.",
    "\n\nSchreibe deine GESAMTE Antwort ausschließlich auf Deutsch — auch die Erklärungen, Tabellenüberschriften und Begründungen, nicht nur die Keywords."
  );
}

async function crawlUrl(url: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)" } });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const getTag = (p: RegExp) => { const m = html.match(p); return m ? m[1]?.trim() || "" : ""; };
    const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);
    const metaDesc = getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const canonical = getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    const ogTitle = getTag(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    const ogDesc = getTag(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
    const robots = getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
    const h1s = Array.from(html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/gi)).map(m => m[1].trim()).filter(Boolean);
    const h2s = Array.from(html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/gi)).map(m => m[1].trim()).filter(Boolean);
    const images = (html.match(/<img[^>]*>/gi) || []).length;
    const imagesWithAlt = (html.match(/<img[^>]*alt=["'][^"']+["'][^>]*>/gi) || []).length;
    const links = (html.match(/<a[^>]*href/gi) || []).length;
    const wordCount = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const hasSchema = html.includes("application/ld+json");
    return { title, metaDesc, h1: h1s.slice(0, 5), h2: h2s.slice(0, 10), images, imagesWithAlt, links, canonical, ogTitle, ogDesc, robots, wordCount, hasSchema };
  } catch { return null; }
}

async function handlePost(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { tool, keyword, content, url, targetKeyword, language } = await req.json();
  // Fall back to the UI language the request actually carries, not a hardcoded
  // "fa" -- an en/de user whose client omitted `language` was served Persian.
  const uiLang = await getServerLang();
  const lang: Lang = language === "fa" || language === "en" || language === "de" ? language : uiLang;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      let systemPrompt = "";
      let userMessage = "";

      if (tool === "url" && url) {
        send(tri(lang, "در حال بارگذاری وبسایت...\n", "Loading website...\n", "Website wird geladen...\n"));
        const data = await crawlUrl(url);
        if (!data) {
          send(tri(lang, "❌ خطا در بارگذاری URL.\n", "❌ Failed to load URL.\n", "❌ URL konnte nicht geladen werden.\n"));
          controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); return;
        }
        send(tri(lang, "✅ وبسایت بارگذاری شد. در حال تحلیل سئو...\n\n---\n\n", "✅ Website loaded. Analyzing SEO...\n\n---\n\n", "✅ Website geladen. SEO-Analyse läuft...\n\n---\n\n"));
        systemPrompt = lang === "fa" ? "تو متخصص سئو حرفه‌ای با ۱۰+ سال تجربه هستی. گزارش جامع، دقیق و عملی سئو ارائه می‌دهی. پاسخ کامل و حرفه‌ای بده." : "You are a professional SEO specialist. Provide comprehensive, accurate and actionable SEO reports.";
        userMessage = lang === "fa"
          ? `تحلیل کامل سئو برای: **${url}**\n\nداده‌های سایت:\n- Title: ${data.title || "❌ ندارد"} (${data.title.length} کاراکتر)\n- Meta Desc: ${data.metaDesc || "❌ ندارد"} (${data.metaDesc.length} کاراکتر)\n- H1: ${data.h1.join(" / ") || "❌ ندارد"}\n- H2: ${data.h2.slice(0,5).join(", ") || "❌ ندارد"}\n- تصاویر: ${data.images} (${data.imagesWithAlt} با alt)\n- لینک‌ها: ${data.links}\n- کلمات: ~${data.wordCount}\n- Canonical: ${data.canonical || "❌ ندارد"}\n- OG Tags: ${data.ogTitle ? "✅" : "❌"}\n- Schema.org: ${data.hasSchema ? "✅" : "❌"}\n${targetKeyword ? `- کلمه کلیدی هدف: ${targetKeyword}` : ""}\n\nگزارش جامع شامل:\n1. امتیاز کلی سئو (از ۱۰۰)\n2. مشکلات بحرانی 🔴\n3. مشکلات متوسط 🟡\n4. نقاط قوت ✅\n5. ۳ Title پیشنهادی (حداکثر ۶۰ کاراکتر)\n6. ۲ Meta Description پیشنهادی (حداکثر ۱۶۰ کاراکتر)\n7. ۱۰ کلمه کلیدی پیشنهادی\n8. برنامه عملی بهبود (۵ اقدام اولویت‌دار)`
          : `Full SEO analysis for: **${url}**\nData: Title(${data.title.length}c), MetaDesc(${data.metaDesc.length}c), H1:${data.h1.length}, Images:${data.images}(${data.imagesWithAlt} alt), Links:${data.links}, Words:${data.wordCount}, Schema:${data.hasSchema}\nProvide: Score/100, Critical issues, Medium issues, Strengths, 3 Title suggestions, 2 Meta descriptions, 10 keywords, Action plan`;
      } else if (tool === "keyword") {
        // Market framing follows the language: a German user researching German
        // keywords was being told the specialist works the Iranian market.
        systemPrompt = tri(lang,
          "متخصص تحقیق کلمات کلیدی برای بازار ایران هستی.",
          "You are a keyword research specialist.",
          "Du bist Spezialist für Keyword-Recherche im deutschsprachigen Markt.");
        userMessage = lang === "fa" ? `تحقیق کلمات کلیدی برای: **"${keyword}"**\n\n۱. ۲۰ کلمه کلیدی مرتبط با جدول (رقابت، حجم جستجو، نیت کاربر)\n۲. ۵ long-tail با رقابت کم\n۳. ۳ کلمه LSI\n۴. سوالات کاربران (People Also Ask)\n۵. استراتژی کلی` : `Keyword research for "${keyword}": 20 related keywords table, 5 long-tail, 3 LSI, People Also Ask, strategy`;
      } else if (tool === "content") {
        systemPrompt = lang === "fa" ? "متخصص بهینه‌سازی محتوا برای سئو هستی." : "Content SEO optimization specialist.";
        userMessage = lang === "fa" ? `بهینه‌سازی محتوا برای: **"${keyword}"**\n\n${content}\n\n۱. نسخه بهینه (تراکم ۱-۳٪)\n۲. ساختار Heading پیشنهادی\n۳. بهبود readability\n۴. کلمات LSI` : `Optimize content for "${keyword}":\n${content}\nProvide: optimized version, heading structure, readability tips, LSI keywords`;
      } else if (tool === "meta") {
        systemPrompt = lang === "fa" ? "متخصص نوشتن meta tags برای سئو هستی." : "Meta tags writing specialist.";
        userMessage = lang === "fa" ? `نوشتن Meta Tags:\nکلمه کلیدی: ${keyword}\nمحتوا: ${content}\n\n۱. ۳ Title Tag (حداکثر ۶۰ کاراکتر)\n۲. ۳ Meta Description (حداکثر ۱۶۰ کاراکتر با CTA)\n۳. OG Tags\n۴. Schema پیشنهادی` : `Write meta tags for keyword "${keyword}" and content "${content}": 3 titles(60c), 3 descriptions(160c), OG tags, Schema`;
      }

      try {
        await routedStreamChat([{ role: "user", content: userMessage }], systemPrompt + outputLanguageRule(lang), (chunk) => send(chunk), (_p) => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : "خطا";
        send(`\n\n❌ ${tri(lang, "خطا در ارتباط با AI: ", "AI error: ", "KI-Fehler: ")}${msg}`);
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}

export const POST = withToolCredits("seo.analyze", handlePost);
