export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      planCode: true, name: true, nameEn: true, price: true, priceUsd: true,
      market: true, duration: true, credits: true, isFeatured: true,
      color: true, features: true,
    },
  });
  return NextResponse.json({ packages });
}
