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

// "Owner" is not a stored role — a CrmContact IS an owner by being linked to
// >=1 property, via EITHER of two separate links: Property.crmContactId
// (the sale/rent-side owner-of-record) or Property.ownerContactId (the
// accounting module's rental-income owner, set from the owner-statements
// page). A contact set up only through the second path — the common case
// for a short-term-rental owner who was never a CRM lead — used to be
// invisible here entirely, because this query checked only the first
// relation. Lists the union of both, each with their properties and the
// representation terms stored on each Property row (see
// Property.representationStartDate/EndDate/agreedCommissionRate).
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkOwnerModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const propertySelect = {
    id: true, title: true, status: true, listingType: true, address: true, city: true,
    representationStartDate: true, representationEndDate: true, agreedCommissionRate: true,
  } as const;

  const contacts = await prisma.crmContact.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}),
      OR: [{ properties: { some: {} } }, { ownedRentalProperties: { some: {} } }],
    },
    select: {
      id: true, name: true, phone: true, email: true,
      properties: { select: propertySelect },
      ownedRentalProperties: { select: propertySelect },
    },
    orderBy: { name: "asc" },
  });

  const owners = contacts.map((c) => {
    // A contact can be the sale-side owner of one unit and the rental-income
    // owner of another (or, in principle, both for the same unit) — merge by
    // property id so it appears once, not twice, in their property list.
    const merged = new Map<string, (typeof c.properties)[number]>();
    for (const p of [...c.properties, ...c.ownedRentalProperties]) merged.set(p.id, p);
    const properties = Array.from(merged.values());
    return { id: c.id, name: c.name, phone: c.phone, email: c.email, propertiesOwnedCount: properties.length, properties };
  });

  return NextResponse.json({ owners });
}
