export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/**
 * Section 1, item 3 — Buyer↔Property match view, feeding the Lead Matcher
 * agent (Section 2, item 1). Buyer search criteria are stored in the
 * existing CrmContact.customFields JSON blob (under a "buyerCriteria" key)
 * rather than a new column/table — same pattern already used for other
 * industry-specific contact data, and it's already editable through the
 * existing PUT /api/crm/contacts/[id] route, so no new write endpoint is
 * needed here — only this read-side matching view.
 */

interface BuyerCriteria {
  propertyType?: string;
  listingType?: string; // "buy" | "rent"
  city?: string;
  budgetMin?: number;
  budgetMax?: number;
  minBedrooms?: number;
}

function parseCriteria(customFields: string | null): BuyerCriteria | null {
  if (!customFields) return null;
  try {
    const parsed = JSON.parse(customFields);
    return parsed?.buyerCriteria || null;
  } catch {
    return null;
  }
}

async function checkModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.matchView");
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const [contacts, properties] = await Promise.all([
    prisma.crmContact.findMany({
      where: {
        userId: ws.workspaceUserId,
        ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}),
      },
      select: { id: true, name: true, phone: true, customFields: true },
    }),
    prisma.property.findMany({
      where: { userId: ws.workspaceUserId, status: "available" },
      select: { id: true, title: true, listingType: true, propertyType: true, price: true, city: true, bedrooms: true, address: true },
    }),
  ]);

  const buyers = contacts
    .map((c) => ({ ...c, criteria: parseCriteria(c.customFields) }))
    .filter((c): c is typeof c & { criteria: BuyerCriteria } => !!c.criteria);

  const results = buyers.map((buyer) => {
    const matches = properties.filter((p) => {
      const price = Number(p.price);
      if (buyer.criteria.propertyType && p.propertyType !== buyer.criteria.propertyType) return false;
      if (buyer.criteria.listingType && p.listingType !== buyer.criteria.listingType) return false;
      if (buyer.criteria.city && p.city !== buyer.criteria.city) return false;
      if (buyer.criteria.budgetMin != null && price < buyer.criteria.budgetMin) return false;
      if (buyer.criteria.budgetMax != null && price > buyer.criteria.budgetMax) return false;
      if (buyer.criteria.minBedrooms != null && (p.bedrooms == null || p.bedrooms < buyer.criteria.minBedrooms)) return false;
      return true;
    });

    return {
      contactId: buyer.id,
      contactName: buyer.name,
      phone: buyer.phone,
      criteria: buyer.criteria,
      matches: matches.map((m) => ({ ...m, price: Number(m.price) })),
    };
  });

  return NextResponse.json({ results });
}
