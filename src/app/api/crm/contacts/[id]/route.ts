export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const contact = await prisma.crmContact.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      deals: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      tasks: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ contact });
}

const EDITABLE_FIELDS = ["name", "phone", "email", "company", "status", "source", "tags", "assignedToId"] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmContact.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) data[key] = body[key];
  }
  if ("customFields" in body) data.customFields = body.customFields ? JSON.stringify(body.customFields) : null;

  const contact = await prisma.crmContact.update({ where: { id: params.id }, data });
  return NextResponse.json({ contact });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmContact.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmActivity.deleteMany({ where: { contactId: params.id } });
  await prisma.crmTask.deleteMany({ where: { contactId: params.id } });
  await prisma.crmDocument.deleteMany({ where: { contactId: params.id } });
  const deals = await prisma.crmDeal.findMany({ where: { contactId: params.id }, select: { id: true } });
  if (deals.length > 0) {
    return NextResponse.json({ error: "این مخاطب معامله فعال دارد — ابتدا معاملات را حذف یا منتقل کنید" }, { status: 400 });
  }
  await prisma.crmContact.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
