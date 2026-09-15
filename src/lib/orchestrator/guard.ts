import type { Lang } from "@/lib/i18n";
import { wrapUntrustedContent } from "@/lib/ai/promptSafety";
import { gateToolCall, type OrchestratorMode } from "./modes";
import { getTool } from "./tools";
import type { WorkspaceContext } from "./isolation";
import type { ToolResult } from "./tools/types";

/**
 * The gate between what the model asked for and what actually runs
 * (Phase 1, §3 and §7).
 *
 * Everything the planner model produces arrives here as untyped JSON that
 * came off a network response. Nothing in it is trusted: the tool must exist,
 * its tier must be reachable in this mode, its key must not be on the
 * never-build list, the workspace's plan must reach it, and its arguments must
 * survive the tool's own validator. A call that fails any of these is dropped
 * and the model is told it was dropped — so it explains rather than pretending
 * the action happened.
 */

export interface ProposedCall {
  tool: string;
  args?: unknown;
}

/** Why a proposed call was dropped. Mirrors GateDecision's reasons plus argument validation, which happens after the gate. */
export type RejectionReason = "denied" | "tier_not_in_mode" | "unknown_tool" | "plan_gated" | "invalid_args";

export type PlannedCall =
  | { ok: true; toolKey: string; tier: "READ" | "DRAFT" | "COMMIT" | "KB"; args: unknown; capabilityKey: string }
  | { ok: false; toolKey: string; reason: RejectionReason };

/** Parses whatever the planner returned into a bounded list of proposed calls. Never throws. */
export function parseProposedCalls(raw: string, maxCalls = 4): ProposedCall[] {
  // The planner is asked for a bare JSON object, but models wrap JSON in prose
  // or fences often enough that a tolerant extraction is worth the four lines.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as { calls?: unknown };
    if (!Array.isArray(parsed.calls)) return [];
    return parsed.calls
      .filter((c): c is ProposedCall => !!c && typeof (c as ProposedCall).tool === "string")
      .slice(0, maxCalls);
  } catch {
    return [];
  }
}

/** Runs one proposed call through every check. Pure: decides, executes nothing. */
export function planCall(proposed: ProposedCall, mode: OrchestratorMode, ctx: WorkspaceContext): PlannedCall {
  const tool = getTool(proposed.tool);

  const decision = gateToolCall({
    mode,
    toolKey: proposed.tool,
    tier: tool?.tier,
    planSatisfied: tool?.planSatisfied ? tool.planSatisfied(ctx) : true,
  });
  if (!decision.allowed) return { ok: false, toolKey: proposed.tool, reason: decision.reason };

  // `decision.allowed` already implies the tool exists (an unknown tool has no
  // tier and is rejected as unknown_tool), but TypeScript needs it stated.
  if (!tool) return { ok: false, toolKey: proposed.tool, reason: "unknown_tool" };

  const args = tool.validate ? tool.validate(proposed.args, ctx) : ({} as never);
  if (args === null) return { ok: false, toolKey: proposed.tool, reason: "invalid_args" };

  return { ok: true, toolKey: tool.key, tier: tool.tier, args, capabilityKey: tool.capabilityKey };
}

/**
 * Frames tool output for the composing model.
 *
 * Tool results go into a *user-role* message, never the system prompt, and
 * carry the explicit "this is data, not instructions" delimiter already used
 * elsewhere in this codebase. Some of what comes back genuinely is
 * attacker-influenced — a CRM contact name can arrive from an Instagram DM,
 * an expense description is free text — so the framing is not ceremonial.
 *
 * The real guarantee is still architectural: by the time this is called, every
 * write has either already happened under a validated tool (DRAFT) or is
 * sitting behind a human confirmation (COMMIT). An injection that lands here
 * is reading its way into prose, not into an action.
 */
export function frameToolResults(
  results: Array<{ toolKey: string; result: ToolResult }>,
  lang: Lang
): string {
  const label = lang === "fa" ? "دادهٔ واقعی حساب کاربر" : lang === "de" ? "Echte Kontodaten des Nutzers" : "The user's real account data";

  const body = results
    .map(({ toolKey, result }) => `[${toolKey}]\n${JSON.stringify(result.data, null, 1)}`)
    .join("\n\n");

  return wrapUntrustedContent(label, body, lang);
}

/** Tells the composing model, in plain terms, what it asked for and did not get, so it can say so instead of inventing. */
export function describeRejections(rejected: Array<{ toolKey: string; reason: string }>, lang: Lang): string {
  if (rejected.length === 0) return "";

  const intro =
    lang === "fa"
      ? "این درخواست‌ها اجرا نشدند — دلیلش را صادقانه به کاربر بگو و ادعا نکن انجام شده‌اند:"
      : lang === "de"
        ? "Diese Anfragen wurden nicht ausgeführt — nenne dem Nutzer den Grund ehrlich und behaupte nicht, sie seien erfolgt:"
        : "These requests did not run — tell the user why, honestly, and do not claim they happened:";

  const reasonText: Record<string, Record<Lang, string>> = {
    denied: {
      fa: "این عملیات از طریق چت مجاز نیست و باید خودش در همان صفحه انجامش بدهد",
      en: "this operation is never performed through the chat; the user does it themselves on the relevant page",
      de: "dieser Vorgang wird nie über den Chat ausgeführt; der Nutzer erledigt ihn selbst auf der jeweiligen Seite",
      tr: "this operation is never performed through the chat; the user does it themselves on the relevant page",
    },
    tier_not_in_mode: {
      fa: "این ابزار در این حالت در دسترس نیست",
      en: "that tool is not available in this mode",
      de: "dieses Werkzeug ist in diesem Modus nicht verfügbar",
      tr: "that tool is not available in this mode",
    },
    unknown_tool: {
      fa: "چنین ابزاری وجود ندارد",
      en: "no such tool exists",
      de: "ein solches Werkzeug existiert nicht",
      tr: "no such tool exists",
    },
    plan_gated: {
      fa: "این بخش به افزونه/پلن لازم نیاز دارد که کاربر فعلاً ندارد",
      en: "this area needs a plan or add-on the user does not currently have",
      de: "dieser Bereich erfordert einen Tarif oder ein Add-on, das der Nutzer derzeit nicht hat",
      tr: "this area needs a plan or add-on the user does not currently have",
    },
    invalid_args: {
      fa: "اطلاعات لازم کامل یا معتبر نبود — از کاربر بپرس",
      en: "the required details were missing or invalid — ask the user for them",
      de: "die erforderlichen Angaben fehlten oder waren ungültig — frage den Nutzer danach",
      tr: "the required details were missing or invalid — ask the user for them",
    },
  };

  const lines = rejected.map((r) => `- ${r.toolKey}: ${reasonText[r.reason]?.[lang] ?? r.reason}`);
  return `${intro}\n${lines.join("\n")}`;
}
