import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import { prisma } from "@/lib/db/prisma";
import type { ChatMessage } from "@/lib/ai/providers";
import { ACTION_TTL_MS } from "./modes";
import { getTool, describeTools, toolsForCapability } from "./tools";
import type { ToolDefinition, ToolResult } from "./tools/types";
import { frameToolResults, describeRejections, parseProposedCalls, planCall } from "./guard";
import { resolveIntent, type DomainKey, type RoutingState } from "./routing";
import type { WorkspaceContext } from "./isolation";

/**
 * The `full_mode` turn lifecycle (Phase 1, §6).
 *
 * Deliberately not built on model tool-calling: Phase 0 could not verify that
 * the free FreeLLMAPI endpoint supports OpenAI-style function calling, and an
 * architecture resting on an unverified capability is one that gets rewritten.
 * Instead: two structured passes that work with any text model.
 *
 *   1. resolveIntent  — free. Keyword + sticky domain (routing.ts).
 *   2. plan           — one model call returning strict JSON tool calls.
 *   3. gate           — server-side. Drops anything not allowed (guard.ts).
 *   4. execute        — READ/DRAFT run now; COMMIT becomes a PENDING action.
 *   5. compose        — the caller streams the final answer, given framed
 *                       tool output plus an honest list of what was refused.
 *
 * This module does steps 1-4 and hands the caller the material for step 5.
 * It never streams and never talks to the user directly, which keeps it
 * testable without a model or an HTTP response.
 */

const DOMAIN_TO_CAPABILITY: Record<DomainKey, string> = {
  crm: "crm",
  accounting: "accounting",
  social: "social",
  ceo: "ceo",
  seo: "seo",
};

export interface OrchestrationPlanInput {
  message: string;
  ctx: WorkspaceContext;
  state: RoutingState;
  conversationId: string;
  /** Runs one non-streaming model call and returns its raw text. Injected so this module is testable without a provider. */
  callPlanner: (system: string, user: string) => Promise<string>;
}

export interface PendingActionCard {
  id: string;
  toolKey: string;
  summary: string;
  expiresAt: Date;
}

export interface OrchestrationResult {
  /** False when no business domain matched — the caller should fall through to ordinary chat, unchanged. */
  handled: boolean;
  domains: DomainKey[];
  /** Framed tool output for the composing model. Empty string when nothing ran. */
  contextBlock: string;
  /** Honest account of what was asked for and refused. Empty string when nothing was refused. */
  rejectionBlock: string;
  /** COMMIT calls awaiting confirmation — the client renders one card per entry. */
  pendingActions: PendingActionCard[];
  /** Capability keys that actually produced data — drives the "based on your CRM data" label. */
  sourceCapabilities: string[];
  /** Routing state to persist for the next turn. */
  nextState: RoutingState;
}

function plannerSystemPrompt(lang: Lang, toolCatalogue: string): string {
  return `You are the tool-planning step of a business assistant. You do NOT talk to the user.

Your only job: decide which of the tools below should run to answer the user's message, and with what arguments.

Available tools:
${toolCatalogue}

Rules:
- Reply with ONLY a JSON object, no prose, no code fences: {"calls":[{"tool":"<key>","args":{...}}]}
- Use at most 3 calls. Prefer the narrowest tool that answers the question.
- If no tool is needed (the user is chatting, asking a general question, or asking something none of these tools covers), reply {"calls":[]}.
- Never invent a tool key that is not listed above.
- For arguments, only use values the user actually provided or an id that appears in the conversation context. Never invent an id.
- A tool marked COMMIT changes live business data and will require the user's explicit confirmation before it runs — propose one only when the user has clearly asked for that change.
- The answer language is ${lang}, but that does not affect this JSON.`;
}

/** Everything the orchestrator knows about this turn, as the composing model's own instruction block. */
export function composerInstruction(lang: Lang, sourceCapabilities: string[], hasPendingActions: boolean): string {
  const base = tri(
    lang,
    `پاسخ را بر پایهٔ «دادهٔ واقعی حساب کاربر» که در همین پیام آمده بنویس. هرگز عددی نساز که در آن داده نیست. اگر داده‌ای خالی بود، صادقانه بگو چیزی ثبت نشده.`,
    `Answer from the "user's real account data" provided in this message. Never invent a figure that is not in it. If a section came back empty, say plainly that there is nothing recorded yet.`,
    `Antworte auf Basis der in dieser Nachricht enthaltenen „echten Kontodaten des Nutzers". Erfinde niemals eine Zahl, die dort nicht steht. Kam ein Abschnitt leer zurück, sage klar, dass noch nichts erfasst ist.`
  );

  const attribution =
    sourceCapabilities.length > 0
      ? tri(
          lang,
          `\nدر پاسخ اشاره کن که این اطلاعات از دادهٔ واقعی خود کاربر در پلتفرم آمده است.`,
          `\nMention in your answer that these figures come from the user's own real data in the platform.`,
          `\nErwähne in deiner Antwort, dass diese Zahlen aus den echten Daten des Nutzers in der Plattform stammen.`
        )
      : "";

  const pending = hasPendingActions
    ? tri(
        lang,
        `\nیک عملیات نیازمند تأیید آماده شده و کارت تأییدش زیر پاسخ تو به کاربر نشان داده می‌شود. فقط بگو چه کاری آماده است و او باید تأیید کند — خودت ادعا نکن که انجام شد.`,
        `\nAn action is staged and its confirmation card is shown to the user below your answer. Say what is staged and that they need to confirm it — do not claim it has already happened.`,
        `\nEine Aktion ist vorbereitet und ihre Bestätigungskarte wird dem Nutzer unter deiner Antwort angezeigt. Sage, was vorbereitet ist und dass er es bestätigen muss — behaupte nicht, es sei bereits erfolgt.`
      )
    : "";

  return `${base}${attribution}${pending}`;
}

/**
 * Steps 1-4. Returns `handled: false` when no domain matched, so the caller
 * leaves ordinary chat completely untouched rather than routing everything
 * through the orchestrator.
 */
export async function orchestrateTurn(input: OrchestrationPlanInput): Promise<OrchestrationResult> {
  const { message, ctx, state, conversationId, callPlanner } = input;

  const intent = resolveIntent(message, state.lastDomain);
  if (intent.domains.length === 0) {
    return {
      handled: false,
      domains: [],
      contextBlock: "",
      rejectionBlock: "",
      pendingActions: [],
      sourceCapabilities: [],
      nextState: state,
    };
  }

  // Only the tools belonging to the matched domains are even shown to the
  // planner, and only those its plan/add-on actually reaches. A model cannot
  // propose what it was never told exists.
  const candidateTools = intent.domains
    .flatMap((d) => toolsForCapability(DOMAIN_TO_CAPABILITY[d]))
    .filter((t) => (t.planSatisfied ? t.planSatisfied(ctx) : true));

  if (candidateTools.length === 0) {
    // The domain matched but nothing in it is reachable for this workspace —
    // typically an unpaid add-on. Handled, with an honest refusal, rather than
    // silently answering from general knowledge as if the data had been read.
    return {
      handled: true,
      domains: intent.domains,
      contextBlock: "",
      rejectionBlock: describeRejections(
        intent.domains.map((d) => ({ toolKey: DOMAIN_TO_CAPABILITY[d], reason: "plan_gated" })),
        ctx.lang
      ),
      pendingActions: [],
      sourceCapabilities: [],
      nextState: { ...state, lastDomain: intent.domains[0] },
    };
  }

  const plannerRaw = await callPlanner(
    plannerSystemPrompt(ctx.lang, describeTools(candidateTools)),
    message
  );
  const proposed = parseProposedCalls(plannerRaw);

  const executed: Array<{ toolKey: string; result: ToolResult }> = [];
  const rejected: Array<{ toolKey: string; reason: string }> = [];
  const pendingActions: PendingActionCard[] = [];
  const sourceCapabilities = new Set<string>();
  const entities = [...state.entities];

  for (const call of proposed) {
    const planned = planCall(call, "full_mode", ctx);
    if (!planned.ok) {
      rejected.push({ toolKey: planned.toolKey, reason: planned.reason });
      continue;
    }

    const tool = getTool(planned.toolKey)!;

    // Resolve any human references ("the Hilton deal", "Won") into real
    // records before staging or running. A reference that matches nothing —
    // or matches ambiguously — is refused here rather than guessed at.
    let args = planned.args;
    if (tool.prepare) {
      try {
        const prepared = await tool.prepare(args as never, ctx);
        if (prepared === null) {
          rejected.push({ toolKey: planned.toolKey, reason: "invalid_args" });
          continue;
        }
        args = prepared;
      } catch (err) {
        console.error(`[Orchestrator] preparing ${planned.toolKey} failed:`, err);
        rejected.push({ toolKey: planned.toolKey, reason: "invalid_args" });
        continue;
      }
    }

    if (planned.tier === "COMMIT") {
      pendingActions.push(await stageCommitAction(tool, args, ctx, conversationId));
      sourceCapabilities.add(planned.capabilityKey);
      continue;
    }

    try {
      const result = await tool.run(args as never, ctx);
      executed.push({ toolKey: planned.toolKey, result });
      if (!result.empty) sourceCapabilities.add(planned.capabilityKey);
      collectEntities(entities, planned.capabilityKey, result);
    } catch (err) {
      console.error(`[Orchestrator] tool ${planned.toolKey} failed:`, err);
      rejected.push({ toolKey: planned.toolKey, reason: "invalid_args" });
    }
  }

  return {
    handled: executed.length > 0 || pendingActions.length > 0 || rejected.length > 0,
    domains: intent.domains,
    contextBlock: executed.length > 0 ? frameToolResults(executed, ctx.lang) : "",
    rejectionBlock: describeRejections(rejected, ctx.lang),
    pendingActions,
    sourceCapabilities: Array.from(sourceCapabilities),
    nextState: { lastDomain: intent.domains[0], entities: entities.slice(-8) },
  };
}

/**
 * Persists a COMMIT call as PENDING and returns its card.
 *
 * The summary stored here is what the user will read. It is built by the
 * tool's own `summarize()` from the *validated* arguments, so the card cannot
 * describe something different from what execution will do — which is the
 * whole point of not letting the model write the card text.
 */
async function stageCommitAction(
  tool: ToolDefinition<never>,
  args: unknown,
  ctx: WorkspaceContext,
  conversationId: string
): Promise<PendingActionCard> {
  const summary = tool.summarize ? tool.summarize(args as never, ctx, ctx.lang) : tool.key;
  const expiresAt = new Date(Date.now() + ACTION_TTL_MS);

  const action = await prisma.orchestratorAction.create({
    data: {
      conversationId,
      workspaceUserId: ctx.workspaceUserId,
      actingUserId: ctx.actingUserId,
      toolKey: tool.key,
      argsJson: JSON.stringify(args),
      summary,
      expiresAt,
    },
    select: { id: true },
  });

  return { id: action.id, toolKey: tool.key, summary, expiresAt };
}

/**
 * Pulls any ids a tool surfaced into the bounded routing state, so a
 * follow-up like "move that one to won" has something to refer to. Ids here
 * are never trusted on the way back in — every tool re-validates them against
 * the workspace (isolation.ts, Rule 3).
 */
function collectEntities(entities: RoutingState["entities"], capabilityKey: string, result: ToolResult): void {
  const data = result.data as Record<string, unknown> | null;
  if (!data) return;

  const domain = (["crm", "accounting", "social", "ceo", "seo"] as DomainKey[]).find((d) => DOMAIN_TO_CAPABILITY[d] === capabilityKey);
  if (!domain) return;

  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue;
    for (const row of value.slice(0, 3)) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      const label = typeof r.title === "string" ? r.title : typeof r.name === "string" ? r.name : typeof r.caption === "string" ? r.caption.slice(0, 40) : r.id;
      if (entities.some((e) => e.id === r.id)) continue;
      entities.push({ domain, kind: key.replace(/s$/, ""), id: r.id, label: String(label) });
    }
  }
}

/** Builds the message array for the composing pass: prior turns, then the framed data and the user's question. */
export function buildComposerMessages(
  history: ChatMessage[],
  message: string,
  contextBlock: string,
  rejectionBlock: string
): ChatMessage[] {
  const parts = [contextBlock, rejectionBlock].filter(Boolean);
  const content = parts.length > 0 ? `${parts.join("\n\n")}\n\n---\n\n${message}` : message;
  return [...history, { role: "user", content }];
}
