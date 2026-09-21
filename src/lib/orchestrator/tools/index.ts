import { isDeniedTool } from "../modes";
import type { ToolDefinition } from "./types";
import { CRM_TOOLS } from "./crm";
import { ACCOUNTING_TOOLS } from "./accounting";
import { SOCIAL_TOOLS } from "./social";
import { STRATEGY_TOOLS } from "./strategy";
import { SEO_TOOLS } from "./seo";

/**
 * The complete `full_mode` tool table.
 *
 * Phase 4's approved scope was four domains: CRM, Accounting,
 * Social (draft-only) and Strategy (read-only). SEO was added as a fifth on the
 * owner's explicit approval (READ tools plus one confirmed audit run; nothing
 * that changes a customer's website). The registry
 * (src/lib/orchestrator/registry.ts) lists eleven business capabilities; the
 * other seven deliberately have no tools, so the orchestrator answers
 * questions about them by explaining and linking rather than acting. That is
 * a scope decision, not an oversight: four domains with real isolation tests
 * beats eleven done thinly.
 */

const ALL_TOOLS: ToolDefinition<never>[] = [...CRM_TOOLS, ...ACCOUNTING_TOOLS, ...SOCIAL_TOOLS, ...STRATEGY_TOOLS, ...SEO_TOOLS];

/**
 * Startup assertion, not a runtime check: if a tool is ever added whose key
 * matches the never-build list, this throws at import time rather than
 * shipping a reachable denied capability. `gateToolCall` checks the same list
 * again per call — this is the "fail closed at build" half of that pair.
 */
const deniedByMistake = ALL_TOOLS.filter((t) => isDeniedTool(t.key));
if (deniedByMistake.length > 0) {
  throw new Error(
    `Orchestrator tool table contains keys on the never-build deny list: ${deniedByMistake.map((t) => t.key).join(", ")}`
  );
}

const duplicateKeys = ALL_TOOLS.map((t) => t.key).filter((k, i, arr) => arr.indexOf(k) !== i);
if (duplicateKeys.length > 0) {
  throw new Error(`Orchestrator tool table has duplicate keys: ${duplicateKeys.join(", ")}`);
}

/** Every COMMIT tool must be able to describe itself for the confirmation card. */
const commitWithoutSummary = ALL_TOOLS.filter((t) => t.tier === "COMMIT" && !t.summarize);
if (commitWithoutSummary.length > 0) {
  throw new Error(
    `COMMIT tools must define summarize() so the confirmation card is built from validated args: ${commitWithoutSummary.map((t) => t.key).join(", ")}`
  );
}

const BY_KEY = new Map(ALL_TOOLS.map((t) => [t.key, t]));

export function getTool(key: string): ToolDefinition<never> | undefined {
  return BY_KEY.get(key);
}

export function allTools(): ToolDefinition<never>[] {
  return ALL_TOOLS;
}

/** Tool keys grouped by the registry capability they belong to — used to route a resolved domain to its tools. */
export function toolsForCapability(capabilityKey: string): ToolDefinition<never>[] {
  return ALL_TOOLS.filter((t) => t.capabilityKey === capabilityKey);
}

/** The one-line catalogue the planner model reads. Only tools reachable in this mode/plan are listed. */
export function describeTools(tools: ToolDefinition<never>[]): string {
  return tools.map((t) => `- ${t.key} (${t.tier}): ${t.description}`).join("\n");
}

export { CRM_TOOLS, ACCOUNTING_TOOLS, SOCIAL_TOOLS, STRATEGY_TOOLS, SEO_TOOLS };
