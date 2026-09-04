export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

async function checkOwnerModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.owner");
}

// "Owner" is not a stored role — a CrmContact IS an owner by being linked
// via Property.crmContactId to >=1 property. This lists exactly those
// contacts, each with their properties and the representation terms stored
// on each Property row (see Property.representationStartDate/EndDate/
// agreedCommissionRate).
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkOwnerModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const contacts = await prisma.crmContact.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}),
      properties: { some: {} },
    },
    select: {
      id: true, name: true, phone: true, email: true,
      properties: {
        select: {
          id: true, title: true, status: true, listingType: true, address: true, city: true,
          representationStartDate: true, representationEndDate: true, agreedCommissionRate: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const owners = contacts.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    propertiesOwnedCount: c.properties.length,
    properties: c.properties,
  }));

  return NextResponse.json({ owners });
}
