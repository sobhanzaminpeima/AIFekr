export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmNote.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { content, isPinned } = body;

  const note = await prisma.crmNote.update({
    where: { id: params.id },
    data: {
      content: content !== undefined ? content.trim() : undefined,
      isPinned: typeof isPinned === "boolean" ? isPinned : undefined,
    },
  });
  return NextResponse.json({ note });
}
