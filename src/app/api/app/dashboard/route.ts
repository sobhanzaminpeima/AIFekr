import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { dashboardData } from "@/lib/home/dashboardData";

export const dynamic = "force-dynamic";

/** The new design's home dashboard: latest creations, credit use and referral commission. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json(await dashboardData(user.id), { headers: { "Cache-Control": "no-store" } });
}
