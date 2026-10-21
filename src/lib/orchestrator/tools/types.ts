import type { Lang } from "@/lib/i18n";
import type { ToolTier } from "../modes";
import type { WorkspaceContext } from "../isolation";

/**
 * The contract every `full_mode` tool implements.
 *
 * Three properties of this shape are load-bearing:
 *
 *   1. `run` receives a `WorkspaceContext`, never a user id. A tool cannot
 *      query another tenant because it is never handed one (isolation.ts).
 *   2. `validate` is server-side and runs on the model's proposed arguments
 *      before anything executes. The model proposes; the server decides.
 *      A tool with no `validate` accepts no arguments at all.
 *   3. `summarize` builds the human-facing description of a COMMIT action
 *      from the VALIDATED arguments, so the confirmation card the user reads
 *      is generated from what will actually run — not from the model's prose
 *      about what it intends to run.
 */

/** A tool that takes no arguments. Named rather than written inline as `{}`, which would accept any non-nullish value. */
export type NoArgs = Record<string, never>;

export interface ToolResult {
  /** Compact, already-computed facts for the model to write prose around. Never raw rows. */
  data: unknown;
  /** Set when the tool ran but had nothing to report, so the model says so instead of inventing. */
  empty?: boolean;
}

export interface ToolDefinition<A = unknown> {
  /** Dotted key, e.g. "crm.pipelineSummary". Also what the deny list is matched against. */
  key: string;
  tier: ToolTier;
  /** Registry capability this tool belongs to — used for the "based on your CRM data" label. */
  capabilityKey: string;
  /** One line the planner model reads to decide whether this tool is relevant. */
  description: string;
  /**
   * Validates and narrows the model's proposed arguments. Returns null to
   * reject the call outright. Must not trust anything in `raw`.
   */
  validate?: (raw: unknown, ctx: WorkspaceContext) => A | null;
  /** Whether this workspace's plan/add-on reaches this tool. Defaults to always true. */
  planSatisfied?: (ctx: WorkspaceContext) => boolean;
  /**
   * Resolves human references into concrete records, server-side and
   * workspace-scoped, before anything is staged or run. Returns null when the
   * reference matches nothing or is ambiguous.
   *
   * This exists because a single planning pass cannot chain tools: the model
   * proposes every call at once, without seeing any results, so it never has
   * a record id to pass. Asking it for one anyway means either an invented id
   * (rejected by `validate`, so the tool is unreachable) or trusting model
   * text as a database key. Instead the model passes what the user said —
   * "the Hilton renewal deal", "Won" — and this step looks it up under the
   * same scoping every read uses. The resolved values are what get stored and
   * what `summarize` describes, so the confirmation card names real records.
   */
  prepare?: (args: A, ctx: WorkspaceContext) => Promise<A | null>;
  /** Required for COMMIT tools: the card text, built from resolved, validated args. */
  summarize?: (args: A, ctx: WorkspaceContext, lang: Lang) => string;
  run: (args: A, ctx: WorkspaceContext) => Promise<ToolResult>;
}

/** Narrowing helper so a heterogeneous tool table can be stored in one map. */
export type AnyToolDefinition = ToolDefinition<never>;

export function defineTool<A>(def: ToolDefinition<A>): ToolDefinition<A> {
  return def;
}

// ─── Shared argument validators ─────────────────────────────────────────────
// Deliberately strict and boring. Every one of these exists because the input
// is model-generated text that reached us over the wire.

/** A cuid-ish id: the model must echo an id we previously showed it, not invent a shape. */
export function validId(raw: unknown): string | null {
  return typeof raw === "string" && /^[a-z0-9]{20,32}$/i.test(raw) ? raw : null;
}

export function validText(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

/** A finite, non-negative amount. Rejects NaN/Infinity/negatives, which a model can produce. */
export function validAmount(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A bounded day count, for "the last N days" style reads. */
export function validDays(raw: unknown, fallback: number, max = 365): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/** A future date within a sane window — used for scheduling drafts. */
export function validFutureDate(raw: unknown, maxDaysAhead = 90): Date | null {
  if (typeof raw !== "string" && !(raw instanceof Date)) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  if (d.getTime() < now - 60_000) return null; // not in the past
  if (d.getTime() > now + maxDaysAhead * 24 * 60 * 60 * 1000) return null;
  return d;
}
