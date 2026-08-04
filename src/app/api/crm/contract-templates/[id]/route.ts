export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmContractTemplate.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmContractTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
