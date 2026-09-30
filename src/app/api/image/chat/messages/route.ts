export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Appends one message to an image-chat conversation. `content` is a JSON
 * string the client already built -- e.g. {"text","sourceImageUrl"} for a
 * user turn, or {"images":[...]} / {"error":"..."} for the assistant turn
 * once /api/image/generate finishes. Kept generic (not re-implementing
 * generation here) so the existing, already-tested /api/image/generate
 * stays the single place that calls providers/deducts credits -- this route
 * only records the conversation transcript around it.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { conversationId, role, content } = await req.json();
  if (!conversationId || !role || typeof content !== "string") {
    return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });
  }
  if (role !== "user" && role !== "assistant") {
    return NextResponse.json({ error: "role نامعتبر است" }, { status: 400 });
  }

  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, userId: user.id, tool: "image" } });
  if (!conv) return NextResponse.json({ error: "گفتگو پیدا نشد" }, { status: 404 });

  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId, role, content } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);

  return NextResponse.json({ message: { id: message.id, role: message.role, content: message.content, createdAt: message.createdAt } });
}
