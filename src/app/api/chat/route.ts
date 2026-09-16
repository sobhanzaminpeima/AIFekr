export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { PROVIDERS, type Provider } from "@/lib/ai/providers";
import { isCustomProviderModel, streamCustomProvider } from "@/lib/ai/customProviders";
import { CREDIT_COSTS } from "@/lib/utils/credits";
import { getAvailableCredits, chargeAndLog } from "@/lib/utils/teamCredits";
import { rateLimit } from "@/lib/utils/rateLimit";
import { getServerLang } from "@/lib/i18n/server";
import { buildWorkspaceContext } from "@/lib/orchestrator/isolation";
import { orchestrateTurn, buildComposerMessages, composerInstruction, type OrchestrationResult } from "@/lib/orchestrator/run";
import { parseRoutingState, serializeRoutingState } from "@/lib/orchestrator/routing";
import { callPlanner } from "@/lib/orchestrator/planner";
import { buildProductKnowledgeBlock } from "@/lib/orchestrator/kb/productContext";
import { logError } from "@/lib/logging/errorLog";

const SUGGESTIONS_INSTRUCTION = `

---
At the end of your response, append this block (it will be parsed by the UI and hidden from display):
<SUGGESTIONS>["سوال پیشنهادی ۱","سوال پیشنهادی ۲","سوال پیشنهادی ۳"]</SUGGESTIONS>
IMPORTANT — these are NOT questions you ask the user. Clicking one immediately sends its exact text back to you as the user's next message. So each must be written in first person, FROM the user's point of view, as a natural next question THEY would ask YOU to continue this specific conversation — e.g. "چطور این رو برای اینستاگرام بومی‌سازی کنم؟" not "هدف شما از این کمپین چیست؟". Base them on what you just answered, not generic follow-ups. The 3 questions must be in the SAME LANGUAGE as the user's message. No text after the SUGGESTIONS block.`;

const PROMPT_BOX_INSTRUCTION = `

---
PROMPT BOX RULE: If the user is asking you to write/generate a prompt for them to use with another AI (a "prompt", "master prompt", "system prompt", "Claude prompt", "Claude Code prompt", "Cursor prompt", "GPT prompt", "AI prompt", or clearly wants text to paste into another AI tool to make it perform a task) — you MUST wrap the actual prompt text in this exact block instead of a plain code block, with any explanation you want to give written OUTSIDE the block (before or after it), never inside:
<PROMPTBOX>{"name":"short descriptive prompt name","type":"Basic Prompt|Professional Prompt|Advanced Prompt|Master Prompt|System Prompt","targetAI":"the AI this prompt is meant for, e.g. Claude, Claude Code, Cursor, GPT, Gemini, or General","language":"English|Persian|...","category":"e.g. Software Development, Marketing, Business, Content","content":"THE FULL PROMPT TEXT ITSELF, exactly as the user should copy-paste it"}</PROMPTBOX>
Only use this block for the prompt content itself — never put your own commentary, caveats, or "here's your prompt" framing inside the "content" field. If the user asks for a "master prompt" specifically, make the content field comprehensive and detailed (cover role, objective, context, tasks, requirements, constraints, and output format as relevant), not a short version. This rule applies regardless of which language the conversation is in.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  default: `You are the AIFekr AI assistant — a warm, highly capable general-purpose assistant. Match your tone and depth to what the user actually asks: casual chat gets a casual, friendly reply; a real business, strategy, or analysis question gets the full depth of a senior consultant/strategist (McKinsey-level analysis, concrete and actionable advice, never vague generalities). Don't assume every message is a business question — a greeting is just a greeting.

**Response format:**
- For simple/casual messages: be brief, warm, and direct — no forced business framing
- For complex or strategic questions: Direct Answer → Key Insight → Practical Steps → Next Action
- Use **bold** for key points, bullet lists for steps, numbered lists for prioritized actions when the content warrants structure

**Rules:**
- Always respond ENTIRELY in the same language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never mix in words or characters from a different language, and never default to Farsi or English when the user wrote in a different one
- When a question is business-related, detect the user's business stage (idea/early/growth/scale) and adapt advice
- When uncertain, ask a clarifying question rather than guessing
- Never hallucinate facts — say "I'd need more context" when you don't know${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,

  business: `You are AIFekr Business Doctor — the world's most experienced business strategist and diagnostician.

Think like BCG + McKinsey + Y Combinator combined. You can look at any business problem and immediately see the root cause, the 3 biggest levers, and the fastest path to results.

**Approach:** Ask sharp diagnostic questions. Identify the REAL problem (not symptoms). Prescribe specific, prioritized actions with timelines and success metrics.

Language rule: always respond in the SAME language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never default to Farsi or English when the user wrote in a different one. Use markdown formatting.${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,

  marketing: `You are AIFekr Marketing Intelligence — a world-class growth marketer and brand strategist.

Expert in: digital marketing, content strategy, SEO/SEM, social media, influencer marketing, viral loops, brand positioning, Iran market specifics, and performance marketing.

**Approach:** Always start with "who is the customer?" Give concrete campaign ideas, copy frameworks, channel strategies, and metrics to track.

Language rule: always respond in the SAME language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never default to Farsi or English when the user wrote in a different one.${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,

  financial: `You are AIFekr Financial Advisor — an elite CFO and financial strategist.

Expert in: financial modeling, unit economics, fundraising, valuation, cash flow management, pricing strategy, Iran banking/finance specifics.

**Approach:** Be precise with numbers. Give frameworks and formulas. Ground advice in realistic data.
IMPORTANT: Educational financial guidance only — not licensed investment advice.

Language rule: always respond in the SAME language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never default to Farsi or English when the user wrote in a different one.${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,

  sales: `You are AIFekr Sales Intelligence — an elite sales strategist and revenue architect.

Expert in: B2B/B2C sales, pipeline management, objection handling, negotiation, pricing, enterprise sales, Iran market sales culture, CRM strategy.

**Approach:** Think in terms of revenue impact. Give scripts, frameworks, and specific tactics to close deals and build sustainable sales systems.

Language rule: always respond in the SAME language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never default to Farsi or English when the user wrote in a different one.${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,

  startup: `You are AIFekr Startup Mentor — a serial entrepreneur who has founded and scaled multiple companies.

Background: 3x founder, angel investor, YC alumni. Expert in: product-market fit, lean startup, fundraising, team building, pivot decisions, growth hacking.

**Approach:** Be brutally honest about startup realities. Share what actually works, not what sounds good in theory. Give tactical, week-by-week guidance.

Language rule: always respond in the SAME language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never default to Farsi or English when the user wrote in a different one.${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,

  legal: `You are AIFekr Legal Advisor — a senior business lawyer specializing in startups and technology companies.

Expert in: company formation, contracts, intellectual property, employment law, regulatory compliance, Iran business law, international business, investor agreements.

IMPORTANT: General legal information for educational purposes only. Always recommend consulting a licensed attorney for specific matters.

Language rule: always respond in the SAME language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never default to Farsi or English when the user wrote in a different one.${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,

  hr: `You are AIFekr People & Culture Strategist — an expert CHRO and organizational psychologist.

Expert in: hiring, team building, culture design, performance management, compensation, leadership development, remote work, Iran labor law basics.

**Approach:** Balance business needs with people wellbeing. Give practical HR frameworks, interview templates, and org design advice.

Language rule: always respond in the SAME language the user just wrote in (Farsi, English, German, Turkish, or any other language) — never default to Farsi or English when the user wrote in a different one.${PROMPT_BOX_INSTRUCTION}${SUGGESTIONS_INSTRUCTION}`,
};

const MAX_AUTO_CREDIT_COST = Math.max(CREDIT_COSTS.chat, ...PROVIDERS.map((p) => p.creditCost));

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  // Credits already gate cost per-message, but that doesn't stop a scripted
  // burst hammering the LLM providers/DB in a tight loop — a light per-user
  // cap as defense-in-depth, generous enough to never bother a real chat session.
  const limit = rateLimit(`chat:${user.id}`, 30, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "تعداد درخواست‌ها بیش از حد مجاز — کمی صبر کنید" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  try {
    const { message, conversationId, model, history = [], systemPrompt, expertMode } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "پیام خالی است" }, { status: 400 });
    }

    // Pre-check against the actual cost the selected model can incur, not a
    // flat floor — a user with e.g. 2 credits could otherwise pass a flat-1
    // check and then get billed 5 for GPT-5, landing their balance negative.
    // "auto"/unset routing can land on any provider, so it's checked against
    // the most expensive one rather than the cheapest.
    const explicitProvider = typeof model === "string" ? PROVIDERS.find((p) => p.model === model) : undefined;
    const expectedCost = isCustomProviderModel(model) ? 3 : explicitProvider?.creditCost ?? MAX_AUTO_CREDIT_COST;
    const availableCredits = await getAvailableCredits(user.id);
    if (availableCredits < expectedCost) {
      return NextResponse.json({ error: "اعتبار کافی ندارید. لطفاً اعتبار خود را شارژ کنید" }, { status: 402 });
    }

    const lang = await getServerLang();

    // Ground answers about AIFekr itself in the real knowledge base instead of
    // whatever the model happens to believe. No-ops (returns "") for every
    // message that isn't a question about the platform -- see productContext.ts.
    const baseSystemStr =
      (systemPrompt || SYSTEM_PROMPTS[expertMode as string] || SYSTEM_PROMPTS.default) +
      (await buildProductKnowledgeBlock(message, lang));

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

    // ─── full_mode orchestration pre-pass ──────────────────────────────────
    // Additive by design: when the message doesn't resolve to one of the
    // enabled business domains, `orchestrateTurn` returns handled:false and
    // everything below runs exactly as it did before this existed. A failure
    // anywhere in here degrades to ordinary chat rather than erroring the
    // user's turn — a broken orchestrator must not break the main chat.
    let orchestration: OrchestrationResult | null = null;
    try {
      const ctx = await buildWorkspaceContext({ id: user.id, plan: user.plan, voicePlan: user.voicePlan }, lang);
      const conv = await prisma.conversation.findUnique({ where: { id: convId }, select: { routingState: true } });
      const result = await orchestrateTurn({
        message,
        ctx,
        state: parseRoutingState(conv?.routingState),
        conversationId: convId,
        callPlanner,
      });
      if (result.handled) {
        orchestration = result;
        await prisma.conversation.update({
          where: { id: convId },
          data: { routingState: serializeRoutingState(result.nextState) },
        });
      }
    } catch (err) {
      console.error("Orchestration pre-pass failed — answering as ordinary chat:", err);
      orchestration = null;
    }

    // Build message history for the API
    const apiMessages = orchestration
      ? buildComposerMessages(history.slice(-10), message, orchestration.contextBlock, orchestration.rejectionBlock)
      : [...history.slice(-10), { role: "user" as const, content: message }];

    // When real account data is in play the composing model gets the extra
    // grounding rules appended (answer only from the data, never invent a
    // figure, don't claim a staged action already happened).
    const systemStr = orchestration
      ? `${baseSystemStr}\n\n${composerInstruction(lang, orchestration.sourceCapabilities, orchestration.pendingActions.length > 0)}`
      : baseSystemStr;

    let assistantContent = "";
    let selectedProvider: Provider | null = null;
    let tokensUsed: number | null = null;
    let promptTokensUsed: number | null = null;
    let completionTokensUsed: number | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          if (isCustomProviderModel(model)) {
            // Admin-added custom provider, picked explicitly by the user —
            // no fallback chain, matches streamCustomProvider's own contract.
            const id = model.slice("custom:".length);
            const row = await prisma.customAiProvider.findUnique({ where: { id } });
            selectedProvider = {
              id: model,
              name: row?.name ?? "Custom",
              model,
              provider: "custom",
              baseURL: "",
              apiKey: "",
              strengths: [],
              maxTokens: 4096,
              creditCost: 3,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ provider: selectedProvider.name })}\n\n`));
            await streamCustomProvider(model, apiMessages, systemStr, (text) => {
              assistantContent += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            });
          } else {
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
              ({ from, partial }) => {
                // Recorded as a warning so fallbacks are measurable in the
                // admin error log — the QA report's fix-order step 7 asked for
                // fallback behaviour to be measured, and until now a provider
                // silently failing over left no trace outside pm2 stdout.
                // Fire-and-forget: this callback is synchronous.
                void logError({
                  source: "/api/chat (provider fallback)",
                  error: new Error(`${from.name} failed${partial ? " mid-response" : ""}; falling back to the next provider`),
                  level: "warn",
                  userId: user.id,
                });
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
                promptTokensUsed = usage.promptTokens;
                completionTokensUsed = usage.completionTokens;
              }
            );
          }

          // Generation succeeded and the full response has already been
          // streamed to the client at this point — from here on, a failure
          // is a billing/bookkeeping problem, not a generation failure, and
          // must never be reported to the user as "failed to get a response"
          // (they already have it). Isolated in its own try/catch so it
          // can't be confused with the generation try above.
          try {
            await prisma.message.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: assistantContent,
              },
            });

            // Deduct credit only now that generation actually succeeded (from
            // the shared team pool if the user is on a team), scaled to the
            // model that was actually used rather than a flat per-message cost.
            // Charge and usage row go in one transaction so we can never end
            // up with one without the other.
            const creditsUsed = selectedProvider?.creditCost ?? CREDIT_COSTS.chat;
            const charged = await chargeAndLog(user.id, creditsUsed, {
              type: "chat",
              model: selectedProvider?.model ?? model ?? "auto",
              tokens: tokensUsed,
              provider: selectedProvider?.id ?? null,
              inputTokens: promptTokensUsed,
              outputTokens: completionTokensUsed,
            });
            if (!charged) {
              // Balance ran out between the pre-flight check and here (a
              // concurrent request won the race). The answer is already
              // streamed, so this is recorded rather than reversed — but it
              // must not pass silently as if the user had been charged.
              await logError({
                source: "/api/chat (uncharged answer)",
                error: new Error(`insufficient credits at charge time: needed ${creditsUsed}`),
                userId: user.id,
              });
            }
          } catch (bookkeepingErr) {
            // Logged for manual reconciliation — the user already has their
            // answer, so we still send [DONE] below rather than an error.
            // Persisted too: a silent credit/message-save failure is exactly
            // the class of bug the admin error log exists to surface.
            await logError({ source: "/api/chat (bookkeeping)", error: bookkeepingErr, userId: user.id });
          }

          // Orchestrator extras, sent once the answer is complete. Actions
          // carry only their stored id — the client fetches the card text from
          // the server, so what the user is asked to confirm comes from the
          // validated arguments and not from anything the model wrote.
          if (orchestration && (orchestration.pendingActions.length > 0 || orchestration.sourceCapabilities.length > 0)) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  actions: orchestration.pendingActions.map((a) => ({ id: a.id, summary: a.summary, expiresAt: a.expiresAt })),
                  dataSources: orchestration.sourceCapabilities,
                })}\n\n`
              )
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          // The report's fix-order step 1 asked that a failure be traceable by
          // request ID. The same short id goes into the admin error log and the
          // user's error message, so a screenshot of the error finds the log row.
          const requestId = globalThis.crypto.randomUUID().slice(0, 8);
          await logError({ source: "/api/chat (stream)", error: err, userId: user.id, requestId });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `خطا در دریافت پاسخ (کد پیگیری: ${requestId})`, requestId })}\n\n`));
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
    const requestId = globalThis.crypto.randomUUID().slice(0, 8);
    await logError({ source: "/api/chat", error: err, userId: user.id, requestId });
    return NextResponse.json({ error: `خطای سرور (کد پیگیری: ${requestId})`, requestId }, { status: 500 });
  }
}
