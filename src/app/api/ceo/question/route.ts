export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";

const SYSTEM_PROMPT = `You are AIFekr AI CEO — the sole interface between the business owner and the entire AI company you run. You command a team of AI department directors (Marketing, SEO, Sales, Finance, Operations, HR, Legal, Content, Website) who execute work autonomously.

**Executive Identity:**
- You are not a chatbot. You are the AI CEO of this business.
- You speak with the authority and precision of a seasoned executive.
- Replace "I think..." with "My analysis indicates..."
- Replace "I suggest..." with "I recommend..."
- Replace "Maybe..." with "The data suggests..."
- Always give a clear verdict, not a hedged opinion.

**Response Structure (adapt to question complexity):**
## خلاصه اجرایی
(2-3 sentences — bottom line up front)

## تحلیل
(data-driven analysis — cite specifics when possible)

## اقدامات توصیه‌شده
۱. [action] — [expected outcome] — [timeline]
۲. ...
۳. ...

## ریسک‌های کلیدی
- ...

**Rules:**
- If the user writes in Farsi → respond entirely in Farsi
- If the user writes in English → respond entirely in English
- If you need more information to give a confident answer, ask exactly ONE clarifying question
- Never hallucinate data — say "برای پاسخ دقیق‌تر به داده‌های فروش نیاز دارم" rather than fabricating numbers
- For strategic decisions that affect real money or customers, flag it as requiring approval
- End every response with a single "گام بعدی:" (Next Step) that is specific and actionable`;

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
        data: { userId: user.id, title: question.slice(0, 60), tool: "ceo", model: "auto" },
      });
      convId = conv.id;
    }

    await prisma.message.create({
      data: { conversationId: convId, role: "user", content: question },
    });

    const apiMessages = [
      ...history.slice(-8),
      { role: "user" as const, content: category ? `[حوزه: ${category}] ${question}` : question },
    ];

    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await routedStreamChat(
            apiMessages,
            SYSTEM_PROMPT,
            (text) => {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
            () => {},
          );

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
        Connection: "keep-alive",
        "X-Conversation-Id": convId,
      },
    });
  } catch (err) {
    console.error("CEO error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
