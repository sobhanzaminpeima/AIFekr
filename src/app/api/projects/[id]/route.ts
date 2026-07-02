export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = params;

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id, projectId: id } as any,
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json({ conversations });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { name, description, color, icon } = await req.json();
  const { id } = params;
  const now = new Date().toISOString();

  await (prisma as any).$executeRaw`
    UPDATE Project SET name = COALESCE(${name}, name), description = COALESCE(${description}, description),
    color = COALESCE(${color}, color), icon = COALESCE(${icon}, icon), updatedAt = ${now}
    WHERE id = ${id} AND userId = ${user.id}
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = params;
  // Remove projectId from conversations
  await (prisma as any).$executeRaw`UPDATE Conversation SET projectId = NULL WHERE projectId = ${id} AND userId = ${user.id}`;
  await (prisma as any).$executeRaw`DELETE FROM Project WHERE id = ${id} AND userId = ${user.id}`;

  return NextResponse.json({ success: true });
}