export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { crmContactLimit } from "@/lib/utils/planGates";
import { countUserContacts } from "@/lib/repositories/crmRepository";
import { resolveCrmWorkspace, agentFilter } from "@/lib/crm/workspace";
import { notify } from "@/lib/notifications/create";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

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
    include: { _count: { select: { properties: true, propertyInterests: true } } },
  });
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const limit = crmContactLimit(user.plan);
  if (limit !== -1) {
    const count = await countUserContacts(ws.workspaceUserId);
    if (count >= limit) {
      return NextResponse.json(
        { error: tri(lang, `پلن شما حداکثر ${limit} مخاطب CRM را پشتیبانی می‌کند. برای مخاطب نامحدود ارتقا دهید.`, `Your plan supports up to ${limit} CRM contacts. Upgrade for unlimited contacts.`, `Ihr Plan unterstützt bis zu ${limit} CRM-Kontakte. Upgraden Sie für unbegrenzte Kontakte.`) },
        { status: 402 }
      );
    }
  }

  const body = await req.json();
  const { name, phone, email, whatsapp, telegram, company, source, status, assignedToId, customFields, sourceDetails } = body;
  if (!name?.trim()) return NextResponse.json({ error: tri(lang, "نام مخاطب الزامی است", "Contact name is required", "Kontaktname ist erforderlich") }, { status: 400 });

  const contact = await prisma.crmContact.create({
    data: {
      userId: ws.workspaceUserId,
      name: name.trim(),
      phone: phone || undefined,
      email: email || undefined,
      whatsapp: whatsapp || undefined,
      telegram: telegram || undefined,
      company: company || undefined,
      source: source || "manual",
      sourceDetails: sourceDetails ? JSON.stringify(sourceDetails) : undefined,
      status: status || "lead",
      // An AGENT's own new contacts default to themselves — they still can't reassign to someone else.
      assignedToId: ws.isAgentRestricted ? ws.actingUserId : assignedToId || undefined,
      customFields: customFields ? JSON.stringify(customFields) : undefined,
    },
  });

  // Notify the workspace owner (not necessarily the caller — an AGENT can
  // create contacts on behalf of the owner's workspace) that a new lead came in.
  notify(ws.workspaceUserId, {
    type: "crm_lead",
    title: `سرنخ جدید: ${contact.name}`,
    body: contact.company || contact.phone || contact.email || undefined,
    link: `/crm?contact=${contact.id}`,
  }).catch(() => {});

  return NextResponse.json({ contact });
}
