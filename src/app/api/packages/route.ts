import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { referralDiscount } from "@/lib/utils/referralPromo";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

import { convertedPackage } from "@/lib/plans/packagePricing";
import { getFxRates } from "@/lib/utils/currency";
export async function GET() {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      planCode: true, name: true, nameEn: true, price: true, priceUsd: true, priceTry: true,
      market: true, duration: true, credits: true, isFeatured: true,
      color: true, features: true, featuresEn: true, teamSeatLimit:true, crmSeatLimit:true,
    },
  });
  const rates = await getFxRates();
  const token=cookies().get("token")?.value;const auth=token?verifyToken(token):null;const promo=auth?await referralDiscount(auth.userId):{percent:0,code:null};
  return NextResponse.json({ promo, fxRates:rates, packages: packages.map(p => convertedPackage(p, rates)) });
}
