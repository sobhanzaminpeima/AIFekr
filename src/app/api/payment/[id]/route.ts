import { bankError } from "@/lib/payment/bankErrors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const user=await requireAuth(req);if(!user)return bankError(req,"Unauthorized",401);
 const payment=await prisma.payment.findFirst({where:{id:params.id,...(!["ADMIN","SUPER_ADMIN"].includes(user.role)?{userId:user.id}:{})},select:{id:true,plan:true,status:true,periodMonths:true,transferCurrency:true,transferMinor:true,bankSnapshot:true,entitlementSnapshot:true,receiptAt:true,reviewNote:true,createdAt:true}});
 if(!payment)return bankError(req,"Not found",404);
 return NextResponse.json({payment});
}
