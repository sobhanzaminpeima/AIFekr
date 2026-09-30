export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const VALID_TOOLS = new Set(["image", "video", "music"]);

/** Generalized version of /api/image/chat/messages -- see that file's doc comment. */
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

  // A null `tool` is the general assistant chat. Image/video/music are tabs on
  // that same composer now, so a generated turn legitimately lands in a
  // tool-less conversation -- rejecting those (as this did) silently dropped
  // every image generated from an existing text conversation.
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, userId: user.id } });
  if (!conv || !(conv.tool === null || VALID_TOOLS.has(conv.tool))) {
    return NextResponse.json({ error: "گفتگو پیدا نشد" }, { status: 404 });
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId, role, content } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);

  return NextResponse.json({ message: { id: message.id, role: message.role, content: message.content, createdAt: message.createdAt } });
}
