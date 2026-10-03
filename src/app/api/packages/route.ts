export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

import { getFxRates } from "@/lib/utils/currency";
export async function GET() {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      planCode: true, name: true, nameEn: true, price: true, priceUsd: true,
      market: true, duration: true, credits: true, isFeatured: true,
      color: true, features: true, featuresEn: true,
    },
  });
  const rates = await getFxRates();
  return NextResponse.json({ packages: packages.map(p => p.planCode.startsWith("STUDENT_") && p.priceUsd != null ? { ...p, price: Math.round(p.priceUsd / 100 * rates.usdToToman) * 10, usdToTry: rates.usdToTry, rateDate: rates.rateDate, isFallback: rates.isFallback } : p) });
}
