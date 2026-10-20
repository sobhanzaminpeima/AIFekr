export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { playOverview } from "@/lib/play/service";
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  try {
    return NextResponse.json(await playOverview(user.id));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PLAY_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
