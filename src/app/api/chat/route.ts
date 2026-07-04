export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import type { Provider } from "@/lib/ai/providers";
import { CREDIT_COSTS } from "@/lib/utils/credits";

const DEFAULT_SYSTEM_FA = `تو یک دستیار هوش مصنوعی هستی. پاسخ‌هایت را به همان زبانی که کاربر صحبت می‌کند بده. اگر فارسی نوشت فارسی جواب بده، اگر انگلیسی نوشت انگلیسی. پاسخ‌هایت مفید، دقیق و کامل باشند.`;

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

    const systemStr = systemPrompt || DEFAULT_SYSTEM_FA;

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

    // Deduct credit
    await prisma.user.update({
      where: { id: user.id },
      data: { credits: { decrement: CREDIT_COSTS.chat } },
    });

    // Build message history for the API
    const apiMessages = [
      ...history.slice(-10),
      { role: "user" as const, content: message },
    ];

    let assistantContent = "";
    let selectedProvider: Provider | null = null;

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
