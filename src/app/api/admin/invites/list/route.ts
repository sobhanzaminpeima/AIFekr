export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Lists everyone ever invited through the admin "Invite to AIfekr" tool
 * (User.invitedByAdminId set), newest first — the management view for
 * revisiting/tracking past invites. Read-only; does not expose any password.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";

  const users = await prisma.user.findMany({
    where: {
      invitedByAdminId: { not: null },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { referralCode: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { invitedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      referralCode: true,
      trialPlan: true,
      trialStartsAt: true,
      trialEndsAt: true,
      realEstatePackage: true,
      mustChangePassword: true,
      invitedByAdminId: true,
      invitedAt: true,
      plan: true,
      planExpiry: true,
      _count: { select: { inviteCards: true } },
    },
  });

  const adminIds = Array.from(new Set(users.map((u) => u.invitedByAdminId).filter(Boolean))) as string[];
  const admins = adminIds.length
    ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
    : [];
  const adminNameById = new Map(admins.map((a) => [a.id, a.name]));

  const now = new Date();
  const items = users.map((u) => ({
    ...u,
    invitedByAdminName: u.invitedByAdminId ? adminNameById.get(u.invitedByAdminId) || null : null,
    trialActive: !!u.trialEndsAt && new Date(u.trialEndsAt) > now,
    cardCount: u._count.inviteCards,
  }));

  return NextResponse.json({ items });
}
