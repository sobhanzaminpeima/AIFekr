export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

// Generic reference data (not real-estate-specific) — any part of the app
// needing a country picker can use this. Deliberately excludes cities
// (250+ countries is small; the city list for one country is fetched
// separately, on demand, since some countries have 10k+ cities).
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const countries = await prisma.country.findMany({
    select: { id: true, iso2: true, name: true, nameFa: true, nameDe: true, emoji: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ countries });
}
