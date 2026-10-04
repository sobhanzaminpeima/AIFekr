export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Image-generation chat sessions -- reuses the same Conversation/Message
 * tables the main text chat uses (see prisma schema: Conversation.tool
 * already distinguishes "ceo"/"meeting" sessions from the default chat the
 * same way), tagged tool: "image". Kept as its own endpoint (rather than
 * folding into /api/chat/history) so the in-page history panel on the image
 * chat screen only ever lists image sessions, never the user's text chats.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id, tool: "image" },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { title } = await req.json().catch(() => ({}));
  const conv = await prisma.conversation.create({
    data: { userId: user.id, tool: "image", title: (title || "").slice(0, 60) || null, model: "auto" },
  });

  return NextResponse.json({ conversation: { id: conv.id, title: conv.title, updatedAt: conv.updatedAt } });
}
