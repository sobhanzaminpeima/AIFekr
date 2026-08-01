export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) return NextResponse.json({ messages: [] });

  try {
    // Verify conversation belongs to this user
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.id },
      select: { id: true, title: true, projectId: true },
    });

    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Capped to the most recent 300 messages — an unbounded findMany here would
    // load an entire long-running conversation's history into memory on every
    // page load; older messages beyond this are still in the DB, just not
    // fetched by this endpoint.
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, role: true, content: true, createdAt: true },
    });
    const messages = recentMessages.reverse();

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      })),
      conversation: conv,
    });
  } catch (e) {
    console.error("history error:", e);
    return NextResponse.json({ messages: [] });
  }
}