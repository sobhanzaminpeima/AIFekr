/**
 * The `support_mode` / `full_mode` boundary, enforced in code (Phase 1, §0 and §3).
 *
 * The whole security argument for this feature rests on this file. If the
 * boundary were "the same orchestrator, told in its prompt not to touch CRM",
 * then one successful prompt injection would turn the support widget into a
 * full data-access agent. Instead the gate is a server-side allowlist checked
 * *after* the model has spoken and *before* anything runs, so the worst a
 * compromised model can do is request something that gets dropped.
 *
 * Note what `support_mode` does NOT appear in below: it has no entry in
 * `MODE_TIERS` granting READ, DRAFT or COMMIT. That is deliberate and is
 * reinforced structurally elsewhere — `support_mode` is served by
 * src/app/api/support/chat/route.ts, which never builds a WorkspaceContext at
 * all, so it has no workspace id to pass a data tool even if one were allowed.
 */

export type OrchestratorMode = "support_mode" | "full_mode";

/**
 * Tiers, in increasing order of consequence:
 *   KB     — knowledge base + navigation. No tenant data at all.
 *   READ   — reads tenant data, always workspace-scoped. Runs immediately.
 *   DRAFT  — writes only to a draft/proposal row a human must approve.
 *            Never touches live business data.
 *   COMMIT — mutates live business data. Requires a second, explicit
 *            confirmation naming a stored OrchestratorAction id.
 */
export type ToolTier = "KB" | "READ" | "DRAFT" | "COMMIT";

const MODE_TIERS: Record<OrchestratorMode, ToolTier[]> = {
  support_mode: ["KB"],
  full_mode: ["KB", "READ", "DRAFT", "COMMIT"],
};

/**
 * Operations that are never tools, in any mode, for any user — including an
 * admin (an admin's chat session is still a chat session; privilege
 * escalation through a text box is exactly the risk).
 *
 * These are matched against a proposed tool key as a defence-in-depth second
 * check: the real guarantee is that no tool implementing them exists in
 * src/lib/orchestrator/tools at all. This list exists so that adding one by
 * mistake later fails closed instead of silently shipping.
 *
 * Each entry is a locked decision, not a policy preference:
 *   - Instagram publishing: master prompt §4, non-negotiable. Note the
 *     related trap the social DRAFT tool has to avoid — the publish cron
 *     fires on `ScheduledPost{mode:"auto", status:"PENDING"}` with no human
 *     action, so a draft created with mode "auto" would publish itself.
 *   - Payments/pricing/plans/credits, deletions, team and role management,
 *     security-relevant settings, and every /admin surface.
 */
export const DENIED_TOOL_PATTERNS: RegExp[] = [
  /\bpublish(es|ed|ing)?\b/i,
  /instagram\.(publish|post|send)/i,
  /\b(delete|remove|destroy|purge)[sd]?\b/i,
  // `pay`/`paid` are listed separately from `payment` because a key like
  // `accounting.payInvoice` normalizes to "accounting pay invoice" — the noun
  // never appears. Note `\bpay\b` deliberately does not match "payroll", so a
  // future read-only payroll summary stays possible.
  /\b(pay|paid|payment|pricing|plan|credit|billing|payout|wallet|refund|charge|subscription)s?\b/i,
  /\b(team|member|role|invite|permission)s?\b/i,
  /\b(password|token|apikey|api_key|secret|credential)s?\b/i,
  /^admin\./i,
  /\badmin\b/i,
  /settings\.(security|account|email|phone)/i,
  /\b(disconnect|revoke|unlink)[sd]?\b/i,
];

/**
 * Splits a tool key into space-separated words so the `\b`-anchored patterns
 * above actually match it.
 *
 * This is not cosmetic. Tool keys are camelCase (`social.publishPost`,
 * `crm.deleteContact`), and in camelCase there is no word boundary between
 * "publish" and "Post" — both are word characters — so `/\bpublish\b/` does
 * NOT match `social.publishPost`. The deny list was therefore letting exactly
 * the keys it exists to block straight through, while looking correct. Caught
 * by modes.test.ts; the test stays as the regression guard.
 *
 * `social.publishPost` -> `social publish post`
 */
function normalizeToolKey(toolKey: string): string {
  return toolKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._\-/]+/g, " ")
    .toLowerCase();
}

/** True when a tool key names something on the never-build list. */
export function isDeniedTool(toolKey: string): boolean {
  const normalized = normalizeToolKey(toolKey);
  // Matched against both forms: the normalized words for the `\b` patterns,
  // and the raw key for the few patterns that target its literal shape
  // (`^admin.`, `instagram.publish`, `settings.security`).
  return DENIED_TOOL_PATTERNS.some((re) => re.test(normalized) || re.test(toolKey));
}

/** Whether a tier is reachable at all in this mode. */
export function modeAllowsTier(mode: OrchestratorMode, tier: ToolTier): boolean {
  return MODE_TIERS[mode].includes(tier);
}

export type GateDecision =
  | { allowed: true }
  | { allowed: false; reason: "denied" | "tier_not_in_mode" | "unknown_tool" | "plan_gated" };

/**
 * The single gate every proposed tool call passes through.
 *
 * Order matters: the deny list is checked first so that a denied key is
 * rejected even if some future mode were given every tier.
 */
export function gateToolCall(params: {
  mode: OrchestratorMode;
  toolKey: string;
  tier: ToolTier | undefined;
  /** False when the workspace's plan/add-on doesn't reach this tool's capability. */
  planSatisfied: boolean;
}): GateDecision {
  if (isDeniedTool(params.toolKey)) return { allowed: false, reason: "denied" };
  if (!params.tier) return { allowed: false, reason: "unknown_tool" };
  if (!modeAllowsTier(params.mode, params.tier)) return { allowed: false, reason: "tier_not_in_mode" };
  if (!params.planSatisfied) return { allowed: false, reason: "plan_gated" };
  return { allowed: true };
}

/** How long a PENDING COMMIT confirmation stays valid. A stale button in an old tab must not fire a write hours later. */
export const ACTION_TTL_MS = 10 * 60 * 1000;
