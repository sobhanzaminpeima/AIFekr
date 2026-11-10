import { prisma } from "@/lib/db/prisma";
import { withDbRetry } from "@/lib/db/retry";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { toolCostKey } from "@/lib/utils/credits";

const MAX_INPUT = 20_000;
const MAX_OUTPUT = 200_000;

export type SeoGenerationInput = {
  userId: string;
  feature: string;
  tool: string;
  keyword?: unknown;
  url?: unknown;
  input: Record<string, unknown>;
  output: string;
  complete?: boolean;
};

const shortText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null);

/**
 * Keeps a paid SEO result so that closing the dialog or losing the connection
 * never loses it (production 2026-11-09: the output existed only in the
 * dialog). A failed save is logged and never breaks the answer already paid for.
 */
export async function saveSeoGeneration(g: SeoGenerationInput): Promise<string | null> {
  const output = g.output.trim();
  if (!output) return null;
  try {
    const costs = await getCreditCosts();
    const credits = costs[toolCostKey(g.feature)] ?? costs.tool;
    const row = await withDbRetry(() =>
      prisma.seoGeneration.create({
        data: {
          userId: g.userId,
          tool: g.tool.slice(0, 40),
          keyword: shortText(g.keyword),
          url: shortText(g.url),
          input: JSON.stringify(g.input).slice(0, MAX_INPUT),
          output: output.slice(0, MAX_OUTPUT),
          credits,
          status: g.complete === false ? "partial" : "complete",
        },
        select: { id: true },
      }),
    );
    return row.id;
  } catch (error) {
    console.error("seo generation: save failed:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
