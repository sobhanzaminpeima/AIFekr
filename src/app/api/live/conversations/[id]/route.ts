export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { LiveError } from "@/lib/live/service";
import { deleteLiveConversation, liveConversationLines } from "@/lib/live/history";

/** One saved AIFekr Live conversation with its lines. */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  try {
    return NextResponse.json(await liveConversationLines(user.id, (await props.params).id));
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  await deleteLiveConversation(user.id, (await props.params).id);
  return NextResponse.json({ ok: true });
}
