export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const contactId = searchParams.get("contactId");

  const tasks = await prisma.crmTask.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(status ? { status } : {}),
      ...(contactId ? { contactId } : {}),
      // CrmTask has no assignedToId of its own — an AGENT only sees tasks
      // tied to a contact assigned to them (workspace-level tasks with no
      // contact stay manager/owner-only).
      ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { contactId, title, dueDate } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "عنوان تسک الزامی است" }, { status: 400 });

  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  } else if (ws.isAgentRestricted) {
    return NextResponse.json({ error: "تسک بدون مخاطب فقط برای مدیران قابل ساخت است" }, { status: 403 });
  }

  const task = await prisma.crmTask.create({
    data: {
      userId: ws.workspaceUserId,
      contactId: contactId || undefined,
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
    },
  });
  return NextResponse.json({ task });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { id, status, title, dueDate } = await req.json();
  if (!id) return NextResponse.json({ error: "شناسه تسک الزامی است" }, { status: 400 });

  const existing = await prisma.crmTask.findFirst({
    where: { id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (title) data.title = title;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  const task = await prisma.crmTask.update({ where: { id }, data });
  return NextResponse.json({ task });
}
