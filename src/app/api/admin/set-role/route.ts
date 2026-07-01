export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, role } = await req.json();
  const allowed = ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"];
  if (!userId || !allowed.includes(role)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await prisma.user.update({ where: { id: userId }, data: { role } });
  return NextResponse.json({ ok: true });
}
