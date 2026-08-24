export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const countryId = req.nextUrl.searchParams.get("countryId");
  if (!countryId) return NextResponse.json({ error: "countryId الزامی است" }, { status: 400 });

  const cities = await prisma.city.findMany({
    where: { countryId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 15000, // largest country (US) has ~12k — generous ceiling, not a real cap
  });
  return NextResponse.json({ cities });
}
