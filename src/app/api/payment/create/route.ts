import { bankError } from "@/lib/payment/bankErrors";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getFxRates } from "@/lib/utils/currency";
import { bankSettings, validIban } from "@/lib/payment/bank";
import { resolvePeriod } from "@/lib/payment/period";
import { STUDENT_PLAN_CODE, STUDENT_MONTHLY_CODE } from "@/lib/plans/studentOffer";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function POST(req: NextRequest) {
 const user=await requireAuth(req); if(!user)return unauthorizedResponse();
 if(!rateLimit(`payment-create:${user.id}`,10,300000).allowed)return bankError(req,"Too many requests",429);
 let body;try{body=await req.json();}catch{return bankError(req,"Invalid request",400);}
 const {plan,period}=body;
 if(typeof plan!=="string")return bankError(req,"Invalid plan",400);
 const tier=plan.startsWith("CREDITS_")?await prisma.creditPricingTier.findUnique({where:{id:plan.slice(8)}}):null;
 const pkg=tier?{isActive:tier.isActive,price:tier.priceToman*10,priceUsd:null,credits:tier.creditsAmount,duration:30,crmSeatLimit:null,teamSeatLimit:null}:await prisma.package.findUnique({where:{planCode:plan}});
 if(!pkg?.isActive)return bankError(req,"Invalid plan",400);
 const intro=plan===STUDENT_PLAN_CODE,student=intro||plan===STUDENT_MONTHLY_CODE;
 if(student && period!=="monthly")return bankError(req,"Invalid billing period",400);
 const {months,discount}=tier?{months:1,discount:0}:student?{months:intro?2:1,discount:0}:resolvePeriod(period);
 const rates=await getFxRates(),bank=await bankSettings();
 if(body.currency === "EUR") { bank.currency="EUR"; bank.iban=bank.euroIban; }
 if(!validIban(bank.iban)||!["TRY","USD","EUR"].includes(bank.currency))return bankError(req,"Bank account is unavailable",503);
 const usd=pkg.priceUsd!=null?pkg.priceUsd/100:pkg.price/10/rates.usdToToman;
 const total=usd*(student?1:months)*(1-discount);
 const minor=Math.round(total*(bank.currency==="TRY"?rates.usdToTry:bank.currency==="EUR"?rates.usdToEur:1)*100);
 if(!Number.isSafeInteger(minor)||minor<=0)return bankError(req,"Package price unavailable",400);
 try {
 const payment=await prisma.$transaction(async tx=>{
  const pending=await tx.payment.findFirst({where:{userId:user.id,plan,status:"PENDING",gateway:"bank_transfer"}});
  if(pending)return pending;
  if(intro&&await tx.payment.findFirst({where:{userId:user.id,plan:{startsWith:"STUDENT_"},status:{in:["PENDING","SUCCESS"]}}}))throw new Error("OFFER_USED");
  return tx.payment.create({data:{userId:user.id,plan,status:"PENDING",gateway:"bank_transfer",amount:Math.round(total*rates.usdToToman),periodMonths:months,transferCurrency:bank.currency,transferMinor:minor,bankSnapshot:JSON.stringify({iban:bank.iban,holder:bank.holder,rateDate:rates.rateDate}),entitlementSnapshot:JSON.stringify({credits:pkg.credits,days:student?(intro?60:30):pkg.duration*months,crmSeatLimit:pkg.crmSeatLimit,teamSeatLimit:pkg.teamSeatLimit})}});
 });
 return NextResponse.json({paymentId:payment.id,paymentUrl:`/checkout/${payment.id}`});
 }catch(e){if(e instanceof Error&&e.message==="OFFER_USED")return bankError(req,"Student welcome offer already used",409);throw e;}
}
