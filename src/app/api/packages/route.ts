import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { referralDiscount } from "@/lib/utils/referralPromo";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

import { getFxRates } from "@/lib/utils/currency";
export async function GET() {
  const packages = await prisma.package.findMany({
    where: { isActive: true,publicVisible:true,publicationStatus:"PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    select: {
      badge:true,termPrices:true,baseCurrency:true,category:true,planCode: true, name: true, nameEn: true, price: true, priceUsd: true, priceTry: true,
      market: true, duration: true, credits: true, isFeatured: true,
      color: true, features: true, featuresEn: true, teamSeatLimit:true, crmSeatLimit:true,
      mediaCredits:true, voiceMinutes:true, crmContactLimit:true, entitlements:true,creditAllocation:true,
    },
  });
  const rates = await getFxRates();
  const token=(await cookies()).get("token")?.value;const auth=token?verifyToken(token):null;const promo=auth?await referralDiscount(auth.userId):{percent:0,code:null};
  const factory=await prisma.siteSetting.findUnique({where:{key:"videoFactoryPolicy"}});
  let videoAvailable=false;try{const policy=JSON.parse(factory?.value||"{}");videoAvailable=process.env.VIDEO_FACTORY_SALES_APPROVED==="true"&&policy.enabled===true&&policy.commercial?.status==="APPROVED";}catch{/* Unavailable factory never accepts purchases. */}
  return NextResponse.json({ promo, fxRates:rates, packages:packages.map(p=>({...p,purchaseAvailable:p.category!=="VIDEO_FACTORY"||videoAvailable})) });
}

