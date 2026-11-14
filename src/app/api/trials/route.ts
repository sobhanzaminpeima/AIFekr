export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { trialStatuses } from "@/lib/trials/registry";

/** E4: the signed-in account's free trials and how many uses are left, counted as generation enforces them. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json({ trials: await trialStatuses(user.id, req.cookies.get("aifekr_did")?.value ?? null) });
}
