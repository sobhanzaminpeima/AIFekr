export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "احراز هویت الزامی است" }, { status: 401 });

  const games = await prisma.game.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, slug: true, name: true, nameEn: true, description: true,
      type: true, isFeatured: true, durationSec: true,
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json({ games });
}
