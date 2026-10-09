import { referralDiscount, applyPromo } from "@/lib/utils/referralPromo";
import {publicAppUrl} from "@/lib/utils/publicAppUrl";
import { createPayment } from "@/lib/payment/zarinpal";
import { isBusinessBundle } from "@/lib/plans/business";
import { bankError } from "@/lib/payment/bankErrors";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getFxRates } from "@/lib/utils/currency";
import { bankSettings, validIban } from "@/lib/payment/bank";
import { subscriptionTerm } from "@/lib/payment/subscriptionTerm";
import { isStudentIntroPlan } from "@/lib/plans/studentOffer";
import { packageUsdPrice } from "@/lib/plans/packagePricing";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function POST(req: NextRequest) {
 const user=await requireAuth(req); if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`payment-create:${user.id}`,10,300000).allowed)return bankError(req,"Too many requests",429);
 let body;try{body=await req.json();}catch{return bankError(req,"Invalid request",400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return bankError(req,"Invalid request",400);
 if(body.currency!==undefined&&!["IRR","TRY","EUR"].includes(body.currency))return bankError(req,"Invalid currency",400);
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
 const intro=isStudentIntroPlan(plan);
 if(plan.startsWith("STUDENT_") && period!=="monthly")return bankError(req,"Invalid billing period",400);
 if(!intro&&!tier&&!["monthly","quarterly","semiannual","annual"].includes(period))return bankError(req,"Invalid billing period",400);
 const {months,discount,priceMultiplier,days}=subscriptionTerm(plan,period,pkg.duration);
 const rates=await getFxRates();
 const rial=body.currency==="IRR";
 const bank=await bankSettings();
 bank.currency=body.currency==="EUR"?"EUR":"TRY";
 if(body.currency === "EUR") { bank.currency="EUR"; bank.iban=bank.euroIban; }
 if(!rial&&(!validIban(bank.iban)||!["TRY","EUR"].includes(bank.currency)))return bankError(req,"Bank account is unavailable",503);
 const usd=packageUsdPrice(pkg,rates);
 const promo=tier?{percent:0,code:null}:await referralDiscount(user.id);
 const originalTotal=usd*priceMultiplier*(1-discount);
 const total=applyPromo(originalTotal,promo.percent);
 const amount=Math.round(total*rates.usdToToman);
 const currency=rial?"IRR":bank.currency;
 const gateway=rial?"zarinpal":"bank_transfer";
 // transferMinor is reserved for foreign-currency cents; rial is converted by the gateway adapter.
 const minor=rial?0:Math.round(total*(bank.currency==="TRY"?rates.usdToTry:bank.currency==="EUR"?rates.usdToEur:1)*100);
 if(!Number.isSafeInteger(amount)||amount<=0||amount>2147483647||!Number.isSafeInteger(minor)||minor>2147483647||(!rial&&minor<=0))return bankError(req,"Package price unavailable",400);
 try {
 const payment=await prisma.$transaction(async tx=>{
  const pending=await tx.payment.findFirst({where:{userId:user.id,plan,...(rial?{amount}:{}),periodMonths:months,transferCurrency:currency,transferMinor:rial?undefined:minor,status:"PENDING",gateway}});
  if(pending&&(!rial||pending.authority))return pending;
  if(pending)throw new Error("PAYMENT_PROCESSING");
  if(promo.percent>0 && await tx.payment.findFirst({where:{userId:user.id,status:"PENDING",promoPercent:{gt:0}}}))throw new Error("PROMO_ORDER_PENDING");
  if(intro&&await tx.payment.findFirst({where:{userId:user.id,plan:{startsWith:"STUDENT_"},status:{in:["PENDING","SUCCESS"]}}}))throw new Error("OFFER_USED");
  return tx.payment.create({data:{promoCode:promo.code,promoPercent:promo.percent,originalAmount:originalTotal*rates.usdToToman<=2147483647?Math.round(originalTotal*rates.usdToToman):null,userId:user.id,plan,status:"PENDING",gateway,amount,periodMonths:months,transferCurrency:currency,transferMinor:minor,bankSnapshot:JSON.stringify({iban:bank.iban,holder:bank.holder,rateDate:rates.rateDate}),entitlementSnapshot:JSON.stringify({credits:pkg.credits * (isBusinessBundle(plan) ? months : 1),businessBundle:isBusinessBundle(plan),...(plan.startsWith("STUDENT_")?{accountType:"STUDENT"}:{}),days,crmSeatLimit:pkg.crmSeatLimit,teamSeatLimit:pkg.teamSeatLimit})}});
 });
 if(rial){
  const callbackUrl=new URL("/api/payment/verify",publicAppUrl());
  callbackUrl.searchParams.set("paymentId",payment.id);
  if(payment.authority)return NextResponse.json({paymentId:payment.id,paymentUrl:payment.bankSnapshot?JSON.parse(payment.bankSnapshot).paymentUrl:null});
  try{
   const result=await createPayment({amount,description:`AIFekr ${plan}`,callbackUrl:callbackUrl.toString()});
   if(!result.ok||!result.authority||!result.paymentUrl)throw new Error("GATEWAY_UNAVAILABLE");
   await prisma.payment.update({where:{id:payment.id},data:{authority:result.authority,bankSnapshot:JSON.stringify({paymentUrl:result.paymentUrl})}});
   return NextResponse.json({paymentId:payment.id,paymentUrl:result.paymentUrl});
  }catch{
   await prisma.payment.updateMany({where:{id:payment.id,status:"PENDING"},data:{status:"FAILED"}});
   return bankError(req,"Payment gateway unavailable",503);
  }
 }
 return NextResponse.json({paymentId:payment.id,paymentUrl:`/checkout/${payment.id}`});
 }catch(e){if(e instanceof Error&&e.message==="PROMO_ORDER_PENDING")return bankError(req,"Complete or cancel the existing discounted order first",409);if(e instanceof Error&&e.message==="PAYMENT_PROCESSING")return bankError(req,"Payment is processing",409);if(e instanceof Error&&e.message==="OFFER_USED")return bankError(req,"Student welcome offer already used",409);throw e;}
}
