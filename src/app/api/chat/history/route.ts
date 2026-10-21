export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) return NextResponse.json({ messages: [] });

  try {
    // Verify conversation belongs to this user
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.id },
      select: { id: true, title: true, projectId: true, tool: true },
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

    // Orchestrator actions staged in this conversation that are still awaiting
    // confirmation. Without this, reloading the page lost the confirmation
    // card while the action itself stayed PENDING in the database for its full
    // ten-minute window — the user could see the assistant say "confirm this"
    // with no button anywhere to do it. Expired ones are left out rather than
    // rendered as dead buttons.
    const pendingActions = await prisma.orchestratorAction.findMany({
      where: {
        conversationId,
        actingUserId: user.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true, summary: true, expiresAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      })),
      conversation: conv,
      pendingActions: pendingActions.map((a) => ({ id: a.id, summary: a.summary, expiresAt: a.expiresAt.toISOString() })),
    });
  } catch (e) {
    console.error("history error:", e);
    return NextResponse.json({ messages: [] });
  }
}
