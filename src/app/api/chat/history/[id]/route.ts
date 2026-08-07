export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const conv = await prisma.conversation.findFirst({ where: { id: params.id, userId: user.id } });
  if (!conv) return NextResponse.json({ error: "گفتگو پیدا نشد" }, { status: 404 });

  await prisma.conversation.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
