/** Request types billed by the unit (image, video, music, voice); a missing token count is expected for them. */
export const isMediaUsage = (type: string) => /^(image|video|music|voice)/.test(type);

type TypeTotal = { type: string; calls: number; credits: number; costUsd: number };
type ToolRow = { type: string; metadata: string | null; credits: number | null; estimatedCostUsd: number | null };

export const TOOL_USAGE_TYPES = ["tool", "seo_research"];

function moduleOfTool(row: ToolRow) {
  if (row.type === "seo_research") return "seo";
  try {
    const feature = (JSON.parse(row.metadata ?? "{}") as { feature?: unknown }).feature;
    if (typeof feature === "string" && feature) return feature.split(/[._]/)[0];
  } catch { /* an unreadable note counts as general tool use */ }
  return "tool";
}

/**
 * Usage per module. All text tools share the type "tool", so SEO could not be
 * told apart from the others; their module comes from the feature recorded
 * with each request. Every other type is already one module.
 */
export function usageByModule(types: TypeTotal[], toolRows: ToolRow[]) {
  const totals = new Map<string, { module: string; calls: number; credits: number; costUsd: number }>();
  const add = (module: string, calls: number, credits: number, costUsd: number) => {
    const row = totals.get(module) ?? { module, calls: 0, credits: 0, costUsd: 0 };
    row.calls += calls;
    row.credits += credits;
    row.costUsd += costUsd;
    totals.set(module, row);
  };
  for (const t of types) if (!TOOL_USAGE_TYPES.includes(t.type)) add(t.type, t.calls, t.credits, t.costUsd);
  for (const r of toolRows) add(moduleOfTool(r), 1, r.credits ?? 0, r.estimatedCostUsd ?? 0);
  return [...totals.values()].sort((a, b) => b.calls - a.calls);
}
