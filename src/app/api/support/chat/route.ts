export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/utils/rateLimit";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { searchKb, searchCapabilities } from "@/lib/orchestrator/kb/search";
import { pickNavigationTarget, buildSupportContext } from "@/lib/orchestrator/support/buildPrompt";
import { buildSupportSystemPrompt, looksLikeWrongLanguage } from "@/lib/orchestrator/support/systemPrompt";
import { streamSupportCompletion, hasSupportModel, SupportModelUnavailableError } from "@/lib/orchestrator/support/model";
import { logError } from "@/lib/logging/errorLog";
import type { ChatMessage } from "@/lib/ai/providers";

/**
 * The floating support assistant's chat endpoint (`support_mode`, master
 * prompt §2, §2.3, §2.4).
 *
 * Deliberately NOT built on `/api/chat`'s route: this endpoint
 *   - never deducts credits (user decision) -- rate-limited instead,
 *   - never routes to a paid provider (see src/lib/orchestrator/support/model.ts),
 *   - never receives a raw `workspaceUserId` or Prisma access to tenant
 *     tables -- its only inputs are the knowledge base and the capability
 *     registry, both platform-wide, not tenant data. That is the actual
 *     security boundary between this and Feature 2's future full_mode
 *     orchestrator, not a prompt instruction (Phase 1 architecture, §0).
 *
 * Conversations reuse the existing Conversation/Message tables, tagged
 * `tool: "support"` -- the same pattern already documented in
 * src/app/api/image/chat/conversations/route.ts -- and are excluded from the
 * main chat sidebar in the dashboard layout.
 */

const RATE_LIMIT_PER_MINUTE = 20;

interface SupportChatBody {
  message?: string;
  conversationId?: string;
  history?: Array<{ role: string; content: string }>;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  // Its own limit, separate from /api/chat's -- this assistant costs no
  // credits, so credits can't do the defense-in-depth job rate limiting does
  // for the main chat route. Generous enough that no real back-and-forth
  // with the widget ever hits it.
  const limit = rateLimit(`support-chat:${user.id}`, RATE_LIMIT_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "تعداد درخواست‌ها بیش از حد مجاز — کمی صبر کنید" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  // Fail loudly rather than silently falling through to a paid model (§2.3)
  // -- checked up front so an unavailable assistant returns a clean error
  // instead of opening a stream that fails partway through.
  if (!hasSupportModel()) {
    return NextResponse.json({ error: "support_model_unavailable" }, { status: 503 });
  }

  let body: SupportChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const lang = await getServerLang();

  // Find-or-create the thread this message belongs to. A stale or foreign id
  // (another user's, or one since deleted) starts a fresh thread rather than
  // erroring -- the widget has nothing worth blocking on here.
  let conversationId = body.conversationId;
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({ where: { id: conversationId, userId: user.id, tool: "support" } });
    if (!existing) conversationId = undefined;
  }
  if (!conversationId) {
    const conv = await prisma.conversation.create({ data: { userId: user.id, tool: "support", title: message.slice(0, 60), model: "auto" } });
    conversationId = conv.id;
  }
  const resolvedConversationId = conversationId;

  await prisma.message.create({ data: { conversationId: resolvedConversationId, role: "user", content: message } });

  const [hits, capMatches, ws] = await Promise.all([searchKb(message, lang, 4), searchCapabilities(message, lang, 2), resolveCrmWorkspace(user.id)]);

  const nav = pickNavigationTarget(hits, capMatches, lang, { plan: user.plan, crmPlan: ws.crmPlan, voicePlan: user.voicePlan });
  const contextBlock = buildSupportContext(hits, capMatches, nav, lang);

  const priorTurns: ChatMessage[] = (body.history ?? [])
    .slice(-6)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const apiMessages: ChatMessage[] = [...priorTurns, { role: "user", content: `${contextBlock}\n\n---\n\n${message}` }];
  const systemPrompt = buildSupportSystemPrompt(lang);

  let assistantContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const runOnce = () =>
          streamSupportCompletion(
            apiMessages,
            systemPrompt,
            (text) => {
              assistantContent += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
            ({ partial }) => {
              // A provider failed after already streaming some text -- discard
              // it so the next provider's answer isn't concatenated onto a
              // half-finished one, mirroring routedStreamChat's own contract.
              if (partial) {
                assistantContent = "";
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reset: true })}\n\n`));
              }
            }
          );

        await runOnce();

        // Runtime safety net, not a substitute for the prompt's own language
        // rule: a free model can still ignore it (found 2026-09-12 -- a
        // Spanish question got a fluent Spanish answer from Groq's
        // gpt-oss-20b, and Spanish isn't even one of this platform's three
        // languages). One retry, with the same strengthened prompt, is enough
        // to recover most of the time without doubling normal-case latency.
        // The already-wrong answer is discarded via the same `reset` event the
        // client already handles for a mid-stream provider failure, so a
        // second correct answer never gets concatenated onto the first.
        if (looksLikeWrongLanguage(assistantContent, lang)) {
          console.warn(`[SupportChat] answer looked like the wrong language (expected ${lang}) -- retrying once`);
          assistantContent = "";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reset: true })}\n\n`));
          await runOnce();
        }

        // Sent once, after the answer completes: the navigation target was
        // decided from the registry before the model ever ran (buildPrompt.ts),
        // not parsed out of the model's own text, so it can't be spoofed by
        // anything the model says.
        controller.enqueue(
          encoder.encode(
            // `title` alongside `heading` -- several documents share an
            // identical section heading ("Where to find it" appears in
            // nearly every capability doc), so the bare heading alone is an
            // ambiguous citation whenever more than one such hit comes back
            // (found while testing: the widget showed "Where to find it"
            // three times over with no way to tell which topic was which).
            `data: ${JSON.stringify({ navigation: nav, sources: hits.map((h) => ({ slug: h.slug, title: h.title, heading: h.heading })) })}\n\n`
          )
        );

        try {
          await prisma.$transaction([
            prisma.message.create({ data: { conversationId: resolvedConversationId, role: "assistant", content: assistantContent } }),
            prisma.conversation.update({ where: { id: resolvedConversationId }, data: { updatedAt: new Date() } }),
          ]);
        } catch (err) {
          // The user already has their answer on screen -- a bookkeeping
          // failure here shouldn't be reported as "failed to answer".
          console.error("Support chat: failed to persist assistant message", err);
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errorCode = err instanceof SupportModelUnavailableError ? "support_model_unavailable" : "خطا در دریافت پاسخ";
        await logError({ source: "/api/support/chat", error: err, userId: user.id });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorCode })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": resolvedConversationId,
    },
  });
}

/** Reopens a previous support-widget thread -- e.g. after the page reloads and the widget is given back its stored conversation id. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ messages: [] });

  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, userId: user.id, tool: "support" } });
  if (!conv) return NextResponse.json({ messages: [] });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return NextResponse.json({ messages });
}
