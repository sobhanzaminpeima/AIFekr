export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

// Most recent notifications for the logged-in user, capped at 30 — this is a
// polling endpoint (see NotificationBell.tsx, ~30s interval) not an infinite
// feed, so no cursor pagination for now.
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

// Mark one notification as read ({ id }) or all of them ({ all: true }).
export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json().catch(() => ({}));

  if (body?.all === true) {
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id or all is required" }, { status: 400 });
  }

  // updateMany (not update) so a stray id for another user's notification
  // silently no-ops instead of leaking a 404/500 or, worse, being findable.
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
