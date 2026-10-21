import { NextResponse } from "next/server";
import { chargeAndLog, refundCredits } from "@/lib/utils/teamCredits";
import { toolCostKey } from "@/lib/utils/credits";
import { getCreditCosts } from "@/lib/utils/creditCosts";

/**
 * Credit gate for the text-LLM "tool" routes (SEO, social, CEO, accounting
 * and CRM assistants...). These used to call the model with no charge and no
 * quota at all, so any logged-in user could run them without limit.
 *
 * The cost is reserved up front -- atomically, through chargeAndLog, so two
 * concurrent requests cannot both spend the last credits -- and handed back
 * with release() if the work then fails, so a user is only ever billed for an
 * answer they actually received. Cost comes from the admin-editable
 * Credit Rules (`tool` by default), so a price change needs no deploy.
 */
export type ToolCharge =
  | { ok: true; credits: number; release: () => Promise<void> }
  | { ok: false; response: NextResponse };

export async function reserveToolCredits(
  userId: string,
  feature: string,
  opts: { cost?: number } = {},
): Promise<ToolCharge> {
  const costs = opts.cost == null ? await getCreditCosts() : null;
  const credits = opts.cost ?? costs![toolCostKey(feature)] ?? costs!.tool;
  if (credits <= 0) return { ok: true, credits: 0, release: async () => {} };

  const charged = await chargeAndLog(userId, credits, { type: "tool", metadata: { feature } });
  if (!charged) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not enough credits", code: "INSUFFICIENT_CREDITS", required: credits },
        { status: 402 },
      ),
    };
  }

  let released = false;
  return {
    ok: true,
    credits,
    // Idempotent: a route that refunds in both its catch and a finally block must not refund twice.
    release: async () => {
      if (released) return;
      released = true;
      await refundCredits(userId, credits);
    },
  };
}
