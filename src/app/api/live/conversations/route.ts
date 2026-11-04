export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { listLiveConversations } from "@/lib/live/history";

/** The caller's saved AIFekr Live conversations, newest first. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json({ conversations: await listLiveConversations(user.id) });
}
