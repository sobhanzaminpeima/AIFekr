export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { streamChat, getModelForPlan } from "@/lib/ai/claude";
import { CREDIT_COSTS } from "@/lib/utils/credits";

const DEFAULT_SYSTEM = `تو یک دستیار هوش مصنوعی فارسی‌زبان هستی. همیشه به فارسی پاسخ بده مگر اینکه کاربر صریحاً زبان دیگری بخواهد. پاسخ‌هایت مفید، دقیق و مختصر باشند.`;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (user.credits < CREDIT_COSTS.chat) {
    return NextResponse.json({ error: "اعتبار کافی ندارید. لطفاً اعتبار خود را شارژ کنید" }, { status: 402 });
  }

  try {
    const { message, conversationId, model, history = [], systemPrompt } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "پیام خالی است" }, { status: 400 });
    }

    const resolvedModel = model || getModelForPlan(user.plan);
    const systemStr = systemPrompt || DEFAULT_SYSTEM;

    // Find or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: message.slice(0, 50),
          model: resolvedModel,
        },
      });
      convId = conv.id;
    }

    // Save user message
    await prisma.message.create({
      data: { conversationId: convId, role: "user", content: message },
    });

    // Deduct credit
    await prisma.user.update({
      where: { id: user.id },
      data: { credits: { decrement: CREDIT_COSTS.chat } },
    });

    // Build messages for API
    const apiMessages = [
      ...history.slice(-10),
      { role: "user" as const, content: message },
    ];

    // Stream response
    let assistantContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          await streamChat(apiMessages, systemStr, resolvedModel, (text) => {
            assistantContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          });

          // Save assistant message
          await prisma.message.create({
            data: { conversationId: convId, role: "assistant", content: assistantContent },
          });

          // Log usage
          await prisma.usageLog.create({
            data: {
              userId: user.id,
              type: "chat",
              model: resolvedModel,
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
        "Connection": "keep-alive",
        "X-Conversation-Id": convId,
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
