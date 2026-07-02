export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { conversationId } = await req.json();
  const { id: projectId } = params;

  await (prisma as any).$executeRaw`
    UPDATE Conversation SET projectId = ${projectId}, updatedAt = datetime('now')
    WHERE id = ${conversationId} AND userId = ${user.id}
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { conversationId } = await req.json();

  await (prisma as any).$executeRaw`
    UPDATE Conversation SET projectId = NULL, updatedAt = datetime('now')
    WHERE id = ${conversationId} AND userId = ${user.id}
  `;

  return NextResponse.json({ success: true });
}