export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId الزامی است" }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: user.id } });
  if (!contact) return NextResponse.json({ error: "مخاطب پیدا نشد" }, { status: 404 });

  const notes = await prisma.crmNote.findMany({
    where: { contactId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { contactId, content, isPinned } = body;
  if (!contactId || !content?.trim()) return NextResponse.json({ error: "contactId و متن یادداشت الزامی است" }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: user.id } });
  if (!contact) return NextResponse.json({ error: "مخاطب پیدا نشد" }, { status: 404 });

  const note = await prisma.crmNote.create({
    data: { userId: user.id, contactId, content: content.trim(), isPinned: !!isPinned },
  });
  return NextResponse.json({ note });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  const existing = await prisma.crmNote.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmNote.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
