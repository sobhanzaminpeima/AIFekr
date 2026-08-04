export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const VALID_STATUSES = ["draft", "sent", "signed", "cancelled"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const contract = await prisma.crmContract.findFirst({
    where: { id: params.id, userId: user.id },
    include: { contact: true, deal: { select: { id: true, title: true } } },
  });
  if (!contract) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ contract });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmContract.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { status, content } = body;
  if (status && !VALID_STATUSES.includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });

  const contract = await prisma.crmContract.update({
    where: { id: params.id },
    data: {
      status: status || undefined,
      content: content !== undefined ? content : undefined,
      signedAt: status === "signed" && existing.status !== "signed" ? new Date() : undefined,
    },
  });
  return NextResponse.json({ contract });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmContract.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmContract.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
