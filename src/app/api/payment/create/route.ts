import { isBusinessBundle } from "@/lib/plans/business";
import { bankError } from "@/lib/payment/bankErrors";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getFxRates } from "@/lib/utils/currency";
import { bankSettings, validIban } from "@/lib/payment/bank";
import { subscriptionTerm } from "@/lib/payment/subscriptionTerm";
import { STUDENT_PLAN_CODE } from "@/lib/plans/studentOffer";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function POST(req: NextRequest) {
 const user=await requireAuth(req); if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`payment-create:${user.id}`,10,300000).allowed)return bankError(req,"Too many requests",429);
 let body;try{body=await req.json();}catch{return bankError(req,"Invalid request",400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return bankError(req,"Invalid request",400);
 if(body.currency!==undefined&&!["TRY","EUR"].includes(body.currency))return bankError(req,"Invalid currency",400);
 const {plan}=body;
 const period = body.period ?? "monthly";
 if(typeof plan!=="string")return bankError(req,"Invalid plan",400);
 if(plan.startsWith("STUDENT_")&&user.accountType!=="STUDENT"&&body.selectStudentAccount!==true)return bankError(req,"STUDENT_ACCOUNT_REQUIRED",403);
 const tier=plan.startsWith("CREDITS_")?await prisma.creditPricingTier.findUnique({where:{id:plan.slice(8)}}):null;
 const pkg=tier?{isActive:tier.isActive,price:tier.priceToman*10,priceUsd:null,credits:tier.creditsAmount,duration:30,crmSeatLimit:null,teamSeatLimit:null}:await prisma.package.findUnique({where:{planCode:plan}});
 if(!pkg?.isActive)return bankError(req,"Invalid plan",400);
 if(isBusinessBundle(plan)) {
  const membership=await prisma.teamMember.findUnique({where:{userId:user.id},include:{team:{select:{ownerId:true}}}});
  if(membership&&membership.team.ownerId!==user.id)return bankError(req,"Only the team owner can purchase a business bundle",409);
  const seats=pkg.teamSeatLimit;
  if(!Number.isInteger(seats)||!seats||seats<1)return bankError(req,"Package capacity unavailable",400);
  const activeMembers=await prisma.teamMember.count({where:{team:{ownerId:user.id}}});
  if(activeMembers>seats)return bankError(req,"Choose a package that covers your current team members",409);
 }
 const intro=plan===STUDENT_PLAN_CODE;
 if(intro && period!=="monthly")return bankError(req,"Invalid billing period",400);
 if(!intro&&!tier&&!["monthly","quarterly","semiannual","annual"].includes(period))return bankError(req,"Invalid billing period",400);
 const {months,discount,priceMultiplier,days}=subscriptionTerm(plan,period,pkg.duration);
 const rates=await getFxRates(),bank=await bankSettings();
 if(body.currency === "EUR") { bank.currency="EUR"; bank.iban=bank.euroIban; }
 if(!validIban(bank.iban)||!["TRY","USD","EUR"].includes(bank.currency))return bankError(req,"Bank account is unavailable",503);
 const usd=pkg.priceUsd!=null?pkg.priceUsd/100:pkg.price/10/rates.usdToToman;
 const total=usd*priceMultiplier*(1-discount);
 const minor=Math.round(total*(bank.currency==="TRY"?rates.usdToTry:bank.currency==="EUR"?rates.usdToEur:1)*100);
 if(!Number.isSafeInteger(minor)||minor<=0)return bankError(req,"Package price unavailable",400);
 try {
 const payment=await prisma.$transaction(async tx=>{
  const pending=await tx.payment.findFirst({where:{userId:user.id,plan,periodMonths:months,transferCurrency:bank.currency,transferMinor:minor,status:"PENDING",gateway:"bank_transfer"}});
  if(pending)return pending;
  if(intro&&await tx.payment.findFirst({where:{userId:user.id,plan:{startsWith:"STUDENT_"},status:{in:["PENDING","SUCCESS"]}}}))throw new Error("OFFER_USED");
  return tx.payment.create({data:{userId:user.id,plan,status:"PENDING",gateway:"bank_transfer",amount:Math.round(total*rates.usdToToman),periodMonths:months,transferCurrency:bank.currency,transferMinor:minor,bankSnapshot:JSON.stringify({iban:bank.iban,holder:bank.holder,rateDate:rates.rateDate}),entitlementSnapshot:JSON.stringify({credits:pkg.credits * (isBusinessBundle(plan) ? months : 1),businessBundle:isBusinessBundle(plan),...(plan.startsWith("STUDENT_")?{accountType:"STUDENT"}:{}),days,crmSeatLimit:pkg.crmSeatLimit,teamSeatLimit:pkg.teamSeatLimit})}});
 });
 return NextResponse.json({paymentId:payment.id,paymentUrl:`/checkout/${payment.id}`});
 }catch(e){if(e instanceof Error&&e.message==="OFFER_USED")return bankError(req,"Student welcome offer already used",409);throw e;}
}
