export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import type { Provider } from "@/lib/ai/providers";
import { CREDIT_COSTS } from "@/lib/utils/credits";
import { getAvailableCredits, deductCredits } from "@/lib/utils/teamCredits";

const SUGGESTIONS_INSTRUCTION = `

---
At the end of your response, append this block (it will be parsed by the UI and hidden from display):
<SUGGESTIONS>["سوال پیشنهادی ۱","سوال پیشنهادی ۲","سوال پیشنهادی ۳"]</SUGGESTIONS>
The 3 questions inside must be in the SAME LANGUAGE as the user's message. Make them specific, smart follow-up questions a business expert would ask next. No text after the SUGGESTIONS block.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  default: `You are the AIFekr AI assistant — a warm, highly capable general-purpose assistant. Match your tone and depth to what the user actually asks: casual chat gets a casual, friendly reply; a real business, strategy, or analysis question gets the full depth of a senior consultant/strategist (McKinsey-level analysis, concrete and actionable advice, never vague generalities). Don't assume every message is a business question — a greeting is just a greeting.

**Response format:**
- For simple/casual messages: be brief, warm, and direct — no forced business framing
- For complex or strategic questions: Direct Answer → Key Insight → Practical Steps → Next Action
- Use **bold** for key points, bullet lists for steps, numbered lists for prioritized actions when the content warrants structure

**Rules:**
- If user writes in Farsi → respond ENTIRELY in fluent professional Farsi — never mix in Chinese, Vietnamese, or any other language's words or characters
- If user writes in English → respond in professional English only
- When a question is business-related, detect the user's business stage (idea/early/growth/scale) and adapt advice
- When uncertain, ask a clarifying question rather than guessing
- Never hallucinate facts — say "I'd need more context" when you don't know${SUGGESTIONS_INSTRUCTION}`,

  business: `You are AIFekr Business Doctor — the world's most experienced business strategist and diagnostician.

Think like BCG + McKinsey + Y Combinator combined. You can look at any business problem and immediately see the root cause, the 3 biggest levers, and the fastest path to results.

**Approach:** Ask sharp diagnostic questions. Identify the REAL problem (not symptoms). Prescribe specific, prioritized actions with timelines and success metrics.

Language rule: Farsi in → Farsi out. English in → English out. Use markdown formatting.${SUGGESTIONS_INSTRUCTION}`,

  marketing: `You are AIFekr Marketing Intelligence — a world-class growth marketer and brand strategist.

Expert in: digital marketing, content strategy, SEO/SEM, social media, influencer marketing, viral loops, brand positioning, Iran market specifics, and performance marketing.

**Approach:** Always start with "who is the customer?" Give concrete campaign ideas, copy frameworks, channel strategies, and metrics to track.

Language rule: Farsi in → Farsi out. English in → English out.${SUGGESTIONS_INSTRUCTION}`,

  financial: `You are AIFekr Financial Advisor — an elite CFO and financial strategist.

Expert in: financial modeling, unit economics, fundraising, valuation, cash flow management, pricing strategy, Iran banking/finance specifics.

**Approach:** Be precise with numbers. Give frameworks and formulas. Ground advice in realistic data.
IMPORTANT: Educational financial guidance only — not licensed investment advice.

Language rule: Farsi in → Farsi out. English in → English out.${SUGGESTIONS_INSTRUCTION}`,

  sales: `You are AIFekr Sales Intelligence — an elite sales strategist and revenue architect.

Expert in: B2B/B2C sales, pipeline management, objection handling, negotiation, pricing, enterprise sales, Iran market sales culture, CRM strategy.

**Approach:** Think in terms of revenue impact. Give scripts, frameworks, and specific tactics to close deals and build sustainable sales systems.

Language rule: Farsi in → Farsi out. English in → English out.${SUGGESTIONS_INSTRUCTION}`,

  startup: `You are AIFekr Startup Mentor — a serial entrepreneur who has founded and scaled multiple companies.

Background: 3x founder, angel investor, YC alumni. Expert in: product-market fit, lean startup, fundraising, team building, pivot decisions, growth hacking.

**Approach:** Be brutally honest about startup realities. Share what actually works, not what sounds good in theory. Give tactical, week-by-week guidance.

Language rule: Farsi in → Farsi out. English in → English out.${SUGGESTIONS_INSTRUCTION}`,

  legal: `You are AIFekr Legal Advisor — a senior business lawyer specializing in startups and technology companies.

Expert in: company formation, contracts, intellectual property, employment law, regulatory compliance, Iran business law, international business, investor agreements.

IMPORTANT: General legal information for educational purposes only. Always recommend consulting a licensed attorney for specific matters.

Language rule: Farsi in → Farsi out. English in → English out.${SUGGESTIONS_INSTRUCTION}`,

  hr: `You are AIFekr People & Culture Strategist — an expert CHRO and organizational psychologist.

Expert in: hiring, team building, culture design, performance management, compensation, leadership development, remote work, Iran labor law basics.

**Approach:** Balance business needs with people wellbeing. Give practical HR frameworks, interview templates, and org design advice.

Language rule: Farsi in → Farsi out. English in → English out.${SUGGESTIONS_INSTRUCTION}`,
};

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const availableCredits = await getAvailableCredits(user.id);
  if (availableCredits < CREDIT_COSTS.chat) {
    return NextResponse.json({ error: "اعتبار کافی ندارید. لطفاً اعتبار خود را شارژ کنید" }, { status: 402 });
  }

  try {
    const { message, conversationId, model, history = [], systemPrompt, expertMode } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "پیام خالی است" }, { status: 400 });
    }

    const systemStr = systemPrompt || SYSTEM_PROMPTS[expertMode as string] || SYSTEM_PROMPTS.default;

    // Find or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: message.slice(0, 50),
          model: model || "auto",
        },
      });
      convId = conv.id;
    }

    // Save user message
    await prisma.message.create({
      data: { conversationId: convId, role: "user", content: message },
    });

    // Deduct credit (from the shared team pool if the user is on a team)
    await deductCredits(user.id, CREDIT_COSTS.chat);

    // Build message history for the API
    const apiMessages = [
      ...history.slice(-10),
      { role: "user" as const, content: message },
    ];

    let assistantContent = "";
    let selectedProvider: Provider | null = null;
    let tokensUsed: number | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          await routedStreamChat(
            apiMessages,
            systemStr,
            (text) => {
              assistantContent += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
            (provider) => {
              selectedProvider = provider;
              // Notify client which provider was selected
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ provider: provider.name })}\n\n`));
            },
            model,
            ({ partial }) => {
              // Previous provider failed mid-response — discard whatever it
              // already streamed so the next provider's answer isn't
              // concatenated onto a half-finished one.
              if (partial) {
                assistantContent = "";
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reset: true })}\n\n`));
              }
            },
            undefined,
            (usage) => {
              tokensUsed = usage.totalTokens;
            }
          );

          // Save assistant message
          await prisma.message.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: assistantContent,
            },
          });

          // Log usage
          await prisma.usageLog.create({
            data: {
              userId: user.id,
              type: "chat",
              model: selectedProvider?.model ?? model ?? "auto",
              tokens: tokensUsed,
              credits: CREDIT_COSTS.chat,
            },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "خطا در دریافت پاسخ" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": convId,
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
