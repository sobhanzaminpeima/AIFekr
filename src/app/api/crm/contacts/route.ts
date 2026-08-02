export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { crmContactLimit } from "@/lib/utils/planGates";
import { countUserContacts } from "@/lib/repositories/crmRepository";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const contacts = await prisma.crmContact.findMany({
    where: { userId: user.id, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const limit = crmContactLimit(user.plan);
  if (limit !== -1) {
    const count = await countUserContacts(user.id);
    if (count >= limit) {
      return NextResponse.json(
        { error: `پلن شما حداکثر ${limit} مخاطب CRM را پشتیبانی می‌کند. برای مخاطب نامحدود ارتقا دهید.` },
        { status: 402 }
      );
    }
  }

  const body = await req.json();
  const { name, phone, email, company, source, status, assignedToId, customFields } = body;
  if (!name?.trim()) return NextResponse.json({ error: "نام مخاطب الزامی است" }, { status: 400 });

  const contact = await prisma.crmContact.create({
    data: {
      userId: user.id,
      name: name.trim(),
      phone: phone || undefined,
      email: email || undefined,
      company: company || undefined,
      source: source || "manual",
      status: status || "lead",
      assignedToId: assignedToId || undefined,
      customFields: customFields ? JSON.stringify(customFields) : undefined,
    },
  });
  return NextResponse.json({ contact });
}
