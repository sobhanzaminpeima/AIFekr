export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { liveBootstrap } from "@/lib/live/service";

/** AIFekr Live screen data: whether it can run, the voices, the price per turn and the balance. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json(await liveBootstrap(user.id));
}
