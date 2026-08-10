export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  try {
    // Not using `include: { user: ... }` here — some UsageLog rows have a userId
    // with no matching User row (e.g. the user was later deleted), and Prisma
    // treats that relation as required, throwing on the whole query instead of
    // returning null for that one row. Fetch logs and users separately and join
    // in JS so an orphaned row just falls back to showing the raw userId.
    const logs = await prisma.usageLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    const userIds = Array.from(new Set(logs.map((l) => l.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      logs: logs.map((l) => {
        const user = userById.get(l.userId);
        return {
          id: l.id,
          userId: l.userId,
          userName: user?.name || user?.email || l.userId,
          model: l.model,
          type: l.type,
          credits: l.credits,
          createdAt: l.createdAt,
          metadata: l.metadata,
        };
      }),
    });
  } catch (err) {
    console.error("admin logs error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
