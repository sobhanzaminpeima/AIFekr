export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Admin-level, read-only, cross-tenant overview of CRM usage — grouped by
 * workspace owner (see resolveCrmWorkspace: CrmContact.userId is always the
 * workspace owner, never an individual team-member agent). This is oversight
 * for support/ops, not a way to create/edit any tenant's actual leads —
 * editing real contacts happens inside each tenant's own /crm.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const contacts = await prisma.crmContact.findMany({
    select: { id: true, userId: true, status: true, createdAt: true },
  });

  const ownerIds = Array.from(new Set(contacts.map((c) => c.userId).filter((id): id is string => !!id)));
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true, email: true, phone: true, plan: true, crmPlan: true },
  });
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  const byOwner = new Map<string, { count: number; statuses: Record<string, number>; lastCreatedAt: string }>();
  for (const c of contacts) {
    if (!c.userId) continue;
    const entry = byOwner.get(c.userId) || { count: 0, statuses: {}, lastCreatedAt: c.createdAt.toISOString() };
    entry.count += 1;
    entry.statuses[c.status] = (entry.statuses[c.status] || 0) + 1;
    if (c.createdAt.toISOString() > entry.lastCreatedAt) entry.lastCreatedAt = c.createdAt.toISOString();
    byOwner.set(c.userId, entry);
  }

  const workspaces = Array.from(byOwner.entries())
    .map(([ownerId, stats]) => ({
      ownerId,
      owner: ownerById.get(ownerId) || null,
      ...stats,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalContacts: contacts.length,
    totalWorkspaces: workspaces.length,
    workspaces,
  });
}
