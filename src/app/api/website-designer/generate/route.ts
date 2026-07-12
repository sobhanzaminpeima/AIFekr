export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";

const SYSTEM = `You are an award-winning web designer and senior front-end developer (ex-Awwwards jury, ex-Stripe design team) who ships pixel-perfect, self-contained landing pages. You never rely on a utility-CSS framework — you hand-write a small, disciplined design system in plain CSS for every project, because your pages must render identically with zero network dependencies beyond fonts/icons.

Hard rules for every website you generate:
- Output ONE self-contained HTML file: all CSS inside a single <style> tag, all JS inside a single <script> tag at the end of <body>. Do NOT use Tailwind, Bootstrap, or any CSS framework CDN — write real CSS with custom properties, flexbox/grid, clamp() for fluid type.
- The only external resources allowed: Google Fonts <link> and inline <svg> icons (draw simple icons yourself as inline SVG paths — do NOT depend on Font Awesome or an icon CDN).
- Define a real design system at the top of <style>: :root custom properties for a cohesive color palette (derived from the requested color preference), a type scale, spacing scale, and border-radius scale. Reuse these tokens everywhere — never hardcode a stray color or size.
- Visual bar: generous whitespace, strong visual hierarchy, layered shadows, subtle gradients, glassmorphism where tasteful, scroll-reveal animations (CSS @keyframes + IntersectionObserver in the inline script), smooth hover states with transform + transition on every interactive element.
- Every section must look distinct from its neighbor (alternate background tones, contained vs full-bleed, image-left/image-right rhythm) — never stack uniform gray cards.
- Use real photography via https://images.unsplash.com/photo-... URLs (pick appropriate existing Unsplash photo IDs for the industry) or CSS-drawn illustrations/gradients — never a broken image placeholder, never a gray box with "IMG" text.
- Fully responsive mobile-first with a real hamburger menu (CSS + inline script toggle, no framework).
- Sticky navigation with smooth-scroll anchor links, active-link highlighting on scroll.
- Write real, specific, persuasive copy for the given business/industry — never Lorem ipsum, never generic placeholder text.
- SEO: proper heading hierarchy (one h1), meta description, descriptive alt text on every image.
- Conversion-focused: clear primary CTA repeated at hero + final section, social proof (testimonials/stats), trust indicators.
- Never truncate. Always emit the complete file through the closing </html> tag.
- Token budget is limited: write compact CSS (no redundant comments, no repeated boilerplate, combine selectors with shared rules) so the FULL page always fits. If you must trade off, spend the budget on completing every requested section over adding extra decorative flourishes — a complete, well-styled page beats a gorgeous but truncated one.`;

function buildPrompt(data: {
  businessName: string;
  industry: string;
  audience: string;
  goal: string;
  colorPref: string;
  style: string;
  sections: string[];
}) {
  const sectionList = data.sections.join(", ");

  return `Design and build a COMPLETE, PRODUCTION-READY, visually stunning website for the following business. Output ONLY the HTML file — no explanation, no truncation.

**Business Details:**
- Name: ${data.businessName}
- Industry: ${data.industry}
- Target Audience: ${data.audience}
- Primary Goal: ${data.goal}
- Color Preference: ${data.colorPref}
- Design Style: ${data.style}
- Sections Required: ${sectionList}

**Design Requirements:**
1. Build a real design system first (color tokens derived from "${data.colorPref}", type scale, spacing scale) as CSS custom properties — then use only those tokens throughout.
2. Professional hero: full viewport height or near it, animated gradient/mesh background OR a real Unsplash photo with a gradient overlay, compelling headline + subheadline, primary + secondary CTA.
3. Each of these sections must be visually distinct with proper spacing, alternating layout rhythm, and real photography where relevant: ${sectionList}.
4. Scroll-reveal animations on section entry, hover-lift + shadow-grow on every card/button, smooth transitions everywhere (150-300ms, ease curves — never abrupt).
5. Mobile-responsive with a working hamburger menu (vanilla JS toggle) and sticky header that gains a background/shadow on scroll.
6. Real, specific, persuasive Persian/English content matched to the ${data.industry} industry — no Lorem ipsum, no "بخش من" placeholders.
7. ${data.style} visual aesthetic throughout, executed with restraint and polish, not generic.
8. Zero external CSS/JS framework dependencies — only Google Fonts link tags and inline SVG icons.

Generate the COMPLETE HTML code block (start with triple backticks html, end with triple backticks). Include:
- DOCTYPE, html (lang=fa dir=rtl), full head with Google Fonts (Vazirmatn) and a single <style> block containing the entire design system + all component/section CSS
- Title: ${data.businessName} — ${data.industry}
- Full body with ALL these sections: ${sectionList}, plus a footer
- A single <script> block at the end of body with: mobile menu toggle, sticky-header-on-scroll, IntersectionObserver-based scroll-reveal
- IMPORTANT: Do not stop early. Complete the entire file including closing html tag.`;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { businessName, industry, audience, goal, colorPref, style, sections = [] } = body;

    if (!businessName || !industry) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const prompt = buildPrompt({ businessName, industry, audience, goal, colorPref, style, sections });
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await routedStreamChat(
            [{ role: "user", content: prompt }],
            SYSTEM,
            (text) => {
              fullContent += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
            () => {},
            undefined,
            undefined,
            16000
          );

          const htmlMatch = fullContent.match(/```html\n([\s\S]*?)```/);
          const htmlCode = htmlMatch ? htmlMatch[1] : fullContent;

          await prisma.generatedWebsite.create({
            data: {
              userId: user.id,
              businessName,
              htmlCode,
              brief: JSON.stringify({ industry, audience, goal, style, sections }),
            },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Website designer stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (err) {
    console.error("Website designer error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
