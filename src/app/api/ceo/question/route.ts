export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";

const SYSTEM_PROMPT = `You are an experienced CEO advisor and business strategist with 20+ years of experience leading Fortune 500 companies and scaling startups. You provide concise, actionable, executive-level advice.

Structure every response with these exact sections:
## Executive Summary
(2-3 sentences — the bottom line)

## Key Insights
- Insight 1
- Insight 2
- Insight 3
- (up to 5 insights)

## Recommended Actions
1. Action 1 (with timeline)
2. Action 2 (with timeline)
3. Action 3 (with timeline)

## Risk Considerations
(2-3 key risks to watch)

Be direct, strategic, and data-informed. Speak as a trusted board advisor.`;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const { question, category, conversationId, history = [] } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    
    let convId = conversationId;
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: { userId: user.id, title: question.slice(0, 60), tool: "ceo", model },
      });
      convId = conv.id;
    }

    await prisma.message.create({
      data: { conversationId: convId, role: "user", content: question },
    });

    const apiMessages = [
      ...history.slice(-8),
      { role: "user" as const, content: category ? `[Category: ${category}] ${question}` : question },
    ];

    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await routedStreamChat(apiMessages, SYSTEM_PROMPT, (text) => {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          });

          await prisma.message.create({
            data: { conversationId: convId, role: "assistant", content: fullResponse },
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: convId })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("CEO stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Conversation-Id": convId,
      },
    });
  } catch (err) {
    console.error("CEO error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
