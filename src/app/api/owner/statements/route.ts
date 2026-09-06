export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/requireOwner";

/**
 * Everything the owner-portal dashboard needs in one call: every property
 * this contact owns, and every statement ever sent to them for those
 * properties (never drafts — a draft's numbers aren't final yet, same rule
 * the /o/[token] single-statement page already follows). Scoped strictly to
 * `ownerContactId = this contact` — an owner can never see another owner's
 * property or another workspace's data through this endpoint.
 */
export async function GET(req: NextRequest) {
  const owner = await requireOwner(req);
  if (!owner) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const properties = await prisma.property.findMany({
    where: { ownerContactId: owner.id },
    select: { id: true, title: true, address: true, city: true },
  });
  const propertyIds = properties.map((p) => p.id);
  if (propertyIds.length === 0) return NextResponse.json({ properties: [], statements: [] });

  const statements = await prisma.accountingOwnerStatement.findMany({
    where: { propertyId: { in: propertyIds }, status: "sent" },
    orderBy: { month: "desc" },
    select: {
      id: true, shareToken: true, month: true, currency: true,
      netProfit: true, managementFee: true, ownerShare: true, sentAt: true, propertyId: true,
    },
  });

  return NextResponse.json({
    properties,
    statements: statements.map((s) => ({ ...s, propertyTitle: properties.find((p) => p.id === s.propertyId)?.title })),
  });
}
