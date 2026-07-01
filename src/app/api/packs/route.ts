export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const packs = await prisma.industryPack.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ packs: packs.map((p) => ({
      ...p,
      targetCustomers: JSON.parse(p.targetCustomers),
      painPoints: JSON.parse(p.painPoints),
      agents: JSON.parse(p.agents),
      outcomes: JSON.parse(p.outcomes),
      kpis: JSON.parse(p.kpis),
    })) });
  } catch (err) {
    console.error("Packs GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
