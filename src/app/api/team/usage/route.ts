export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Phase 4's "AI Workforce Usage" business dashboard -- a per-member usage
 * breakdown for the requesting user's team, so an owner can see who on the
 * team is actually spending the shared credit pool and on what. Any team
 * member can view it (not owner-only), matching how the shared credit
 * balance itself is already visible to every member.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
  if (!membership) return NextResponse.json({ team: null });

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") || 30), 90);
  const since = new Date(Date.now() - days * 86_400_000);

  const members = await prisma.teamMember.findMany({
    where: { teamId: membership.teamId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const memberIds = members.map((m) => m.userId);

  const byMember = await prisma.usageLog.groupBy({
    by: ["userId", "type"],
    where: { userId: { in: memberIds }, createdAt: { gte: since } },
    _sum: { credits: true },
    _count: { _all: true },
  });

  const breakdown = members.map((m) => {
    const rows = byMember.filter((r) => r.userId === m.userId);
    const byType = rows.map((r) => ({ type: r.type, count: r._count._all, creditsSpent: r._sum.credits || 0 }));
    return {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      totalCreditsSpent: byType.reduce((sum, r) => sum + r.creditsSpent, 0),
      byType: byType.sort((a, b) => b.creditsSpent - a.creditsSpent),
    };
  }).sort((a, b) => b.totalCreditsSpent - a.totalCreditsSpent);

  return NextResponse.json({ days, breakdown });
}
