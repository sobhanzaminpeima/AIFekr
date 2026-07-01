export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { streamChat, getModelForPlan } from "@/lib/ai/claude";

const SYSTEM = `You are an award-winning web designer and senior developer with expertise in modern design systems, UX principles, and conversion optimization. You create stunning, professional websites that convert visitors to customers.

When generating websites:
- Use semantic HTML5 with embedded CSS (custom properties for theming) + Tailwind CSS via CDN
- Create COMPLETE, FULLY-FUNCTIONAL single-page websites — never truncate or leave sections incomplete
- Use modern design: glassmorphism, gradients, micro-animations, shadows
- Include CSS animations (AOS-style on scroll, hover effects, smooth transitions)
- Make ALL sections fully responsive (mobile-first)
- Use professional fonts from Google Fonts (embedded in <head>)
- Include Font Awesome or Lucide icons via CDN
- Write real placeholder content that fits the business (not Lorem ipsum)
- SEO-optimized: proper heading hierarchy, meta tags, alt texts
- Conversion-focused: clear CTAs, social proof, trust indicators`;

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

  return `Generate a COMPLETE, PRODUCTION-READY website for the following business. Output ONLY the HTML file — no explanation, no truncation.

**Business Details:**
- Name: ${data.businessName}
- Industry: ${data.industry}
- Target Audience: ${data.audience}
- Primary Goal: ${data.goal}
- Color Preference: ${data.colorPref}
- Design Style: ${data.style}
- Sections Required: ${sectionList}

**Design Requirements:**
1. Professional hero with animated gradient background, compelling headline and subheadline
2. Each section must be visually distinct with proper spacing and contrast
3. Use CSS custom properties for the color theme based on "${data.colorPref}"
4. Include hover animations on cards, buttons, links
5. Mobile-responsive with hamburger menu
6. Sticky navigation with smooth scroll
7. Real content specific to ${data.industry} industry (not Lorem ipsum)
8. ${data.style} visual aesthetic throughout

Generate the COMPLETE HTML code block (start with triple backticks html, end with triple backticks). Include:
- DOCTYPE, html (lang=fa dir=rtl), full head with Tailwind CDN, Font Awesome, Vazirmatn Google Font
- Title: ${data.businessName} — ${data.industry}
- Full body with ALL these sections: ${sectionList}
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

    const model = getModelForPlan(user.plan);
    const prompt = buildPrompt({ businessName, industry, audience, goal, colorPref, style, sections });
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await streamChat([{ role: "user", content: prompt }], SYSTEM, model, (text) => {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          });

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
