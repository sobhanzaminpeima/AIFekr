export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { expirePromoCredits } from "@/lib/credits/freeCredits";

// Hit hourly by a system crontab entry: removes what is left of expired free (promotional) credits.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await expirePromoCredits());
}
