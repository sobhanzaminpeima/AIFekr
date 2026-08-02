export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const dealId = searchParams.get("dealId");

  const activities = await prisma.crmActivity.findMany({
    where: {
      userId: user.id,
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { contactId, dealId, type, content } = await req.json();
  if (!type || !content?.trim()) return NextResponse.json({ error: "نوع و متن فعالیت الزامی است" }, { status: 400 });

  // Only attach to a contact/deal that's actually this user's.
  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: user.id } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  }
  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: user.id } });
    if (!deal) return NextResponse.json({ error: "معامله یافت نشد" }, { status: 404 });
  }

  const activity = await prisma.crmActivity.create({
    data: { userId: user.id, contactId: contactId || undefined, dealId: dealId || undefined, type, content: content.trim() },
  });

  if (contactId) {
    await prisma.crmContact.update({ where: { id: contactId }, data: { lastContact: new Date() } });
  }

  return NextResponse.json({ activity });
}
