export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { crmContactLimit } from "@/lib/utils/planGates";
import { countUserContacts } from "@/lib/repositories/crmRepository";
import { resolveCrmWorkspace, agentFilter } from "@/lib/crm/workspace";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const contacts = await prisma.crmContact.findMany({
    where: { userId: ws.workspaceUserId, ...(status ? { status } : {}), ...agentFilter(ws) },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const limit = crmContactLimit(user.plan);
  if (limit !== -1) {
    const count = await countUserContacts(ws.workspaceUserId);
    if (count >= limit) {
      return NextResponse.json(
        { error: `پلن شما حداکثر ${limit} مخاطب CRM را پشتیبانی می‌کند. برای مخاطب نامحدود ارتقا دهید.` },
        { status: 402 }
      );
    }
  }

  const body = await req.json();
  const { name, phone, email, company, source, status, assignedToId, customFields, sourceDetails } = body;
  if (!name?.trim()) return NextResponse.json({ error: "نام مخاطب الزامی است" }, { status: 400 });

  const contact = await prisma.crmContact.create({
    data: {
      userId: ws.workspaceUserId,
      name: name.trim(),
      phone: phone || undefined,
      email: email || undefined,
      company: company || undefined,
      source: source || "manual",
      sourceDetails: sourceDetails ? JSON.stringify(sourceDetails) : undefined,
      status: status || "lead",
      // An AGENT's own new contacts default to themselves — they still can't reassign to someone else.
      assignedToId: ws.isAgentRestricted ? ws.actingUserId : assignedToId || undefined,
      customFields: customFields ? JSON.stringify(customFields) : undefined,
    },
  });
  return NextResponse.json({ contact });
}
