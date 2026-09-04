export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: tri(lang, "contactId الزامی است", "contactId is required", "contactId ist erforderlich") }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
  if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب پیدا نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });

  const notes = await prisma.crmNote.findMany({
    where: { contactId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const body = await req.json();
  const { contactId, content, isPinned } = body;
  if (!contactId || !content?.trim()) return NextResponse.json({ error: tri(lang, "contactId و متن یادداشت الزامی است", "contactId and note content are required", "contactId und Notizinhalt sind erforderlich") }, { status: 400 });

  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
  if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب پیدا نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });

  const note = await prisma.crmNote.create({
    data: { userId: ws.workspaceUserId, contactId, content: content.trim(), isPinned: !!isPinned },
  });
  return NextResponse.json({ note });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: tri(lang, "id الزامی است", "id is required", "id ist erforderlich") }, { status: 400 });

  const existing = await prisma.crmNote.findFirst({
    where: { id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  await prisma.crmNote.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
