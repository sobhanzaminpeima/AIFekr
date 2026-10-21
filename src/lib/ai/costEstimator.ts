import { prisma } from "@/lib/db/prisma";

/**
 * Computes the $ cost of a single AI call from the admin-editable
 * AiModelPricing table. Returns null (not 0) when no pricing row exists
 * for the given providerId+kind, so callers/UsageLog can tell "known to
 * cost nothing" apart from "we don't have a price for this yet" -- the
 * latter should never silently show up as $0 in a profitability report.
 */
export interface ChatCostInput {
  kind: "chat";
  providerId: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
}

export interface MediaCostInput {
  kind: "image" | "video" | "music" | "voice";
  providerId: string;
  units: number;
}

export type CostInput = ChatCostInput | MediaCostInput;

export async function estimateCostUsd(input: CostInput): Promise<number | null> {
  const pricing = await prisma.aiModelPricing.findUnique({
    where: { providerId_kind: { providerId: input.providerId, kind: input.kind } },
  });
  if (!pricing || !pricing.isActive) return null;

  if (input.kind === "chat") {
    if (pricing.inputPricePerMillion == null || pricing.outputPricePerMillion == null) return null;
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;
    // Cached tokens are billed at the input rate too when no separate cached
    // rate is configured -- treating them as free would understate cost.
    const billableInputTokens = inputTokens + (input.cachedTokens ?? 0);
    return (
      (billableInputTokens / 1_000_000) * pricing.inputPricePerMillion +
      (outputTokens / 1_000_000) * pricing.outputPricePerMillion
    );
  }

  if (pricing.pricePerUnit == null) return null;
  return input.units * pricing.pricePerUnit;
}
