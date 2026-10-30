import {releaseFailedPromotion} from "@/lib/billing/releasePromotion";
import { GROWTH_MODULES, moduleEntry } from "@/lib/growth/modules";
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
import { priceForPeriod } from "@/lib/billing/plans";
import { packageUsdPrice } from "@/lib/plans/packagePricing";
import { rateLimit } from "@/lib/utils/rateLimit";
import { closeAbandonedGatewayOrder } from "@/lib/payment/adminLifecycle";
/** A module the buyer upgraded from; payment/verify sends them back there (see resultPath). */
const MODULE_RETURN_PATHS: unknown[] = GROWTH_MODULES.flatMap(m => [m.paths[0], moduleEntry(m)]);
export async function POST(req: NextRequest) {
 const user=await requireAuth(req); if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`payment-create:${user.id}`,10,300000).allowed)return bankError(req,"Too many requests",429);
 let body;try{body=await req.json();}catch{return bankError(req,"Invalid request",400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return bankError(req,"Invalid request",400);
 if(body.currency!==undefined&&!["IRR","TRY","EUR","USD"].includes(body.currency))return bankError(req,"Invalid currency",400);
 const {plan}=body;
 const period = body.period ?? "monthly";
 if(typeof plan!=="string")return bankError(req,"Invalid plan",400);
 if(plan.startsWith("STUDENT_")&&user.accountType!=="STUDENT"&&body.selectStudentAccount!==true)return bankError(req,"STUDENT_ACCOUNT_REQUIRED",403);
 const tier=plan.startsWith("CREDITS_")?await prisma.creditPricingTier.findUnique({where:{id:plan.slice(8)}}):null;
 const pkg=tier?{isActive:tier.isActive,price:tier.priceToman*10,priceUsd:null,credits:tier.creditsAmount,duration:30,crmSeatLimit:null,teamSeatLimit:null}:await prisma.package.findUnique({where:{planCode:plan}});
 if(!pkg?.isActive || ("publicationStatus" in pkg && pkg.publicationStatus!=="PUBLISHED"))return bankError(req,"Invalid plan",400);
 if("category" in pkg&&pkg.category==="VIDEO_FACTORY"&&process.env.VIDEO_FACTORY_SALES_APPROVED!=="true")return bankError(req,"OWNER_SALES_APPROVAL_REQUIRED",403);
 if("category" in pkg&&pkg.category==="VIDEO_FACTORY"&&process.env.VIDEO_FACTORY_SALES_APPROVED!=="true")return bankError(req,"OWNER_SALES_APPROVAL_REQUIRED",403);
 if("category" in pkg&&pkg.category==="FITNESS"){const profile=await prisma.fitnessProfile.findUnique({where:{userId:user.id}});if(!profile?.goal.trim())return bankError(req,"FITNESS_ONBOARDING_REQUIRED",409);}
 if(isBusinessBundle(plan)) {
  const membership=await prisma.teamMember.findUnique({where:{userId:user.id},include:{team:{select:{ownerId:true}}}});
  if(membership&&membership.team.ownerId!==user.id)return bankError(req,"Only the team owner can purchase a business bundle",409);
  const seats=pkg.teamSeatLimit;
  if(!Number.isInteger(seats)||!seats||seats<1)return bankError(req,"Package capacity unavailable",400);
  const activeMembers=await prisma.teamMember.count({where:{team:{ownerId:user.id}}});
  if(activeMembers>seats)return bankError(req,"Choose a package that covers your current team members",409);
 }
 const intro=isStudentIntroPlan(plan);
 if(plan.startsWith("STUDENT_") && period!=="monthly" && !("termPrices" in pkg && pkg.termPrices!=="{}"))return bankError(req,"Invalid billing period",400);
 if(!intro&&!tier&&!["monthly","quarterly","semiannual","annual",...("termPrices" in pkg&&pkg.termPrices!=="{}"?["custom"]:[])].includes(period))return bankError(req,"Invalid billing period",400);
 const term=subscriptionTerm(plan,period,pkg.duration);let months=term.months,days=term.days;const {discount,priceMultiplier}=term;
 let configured=null;try{configured=!body.quoteId&&"termPrices" in pkg&&pkg.termPrices!=="{}"?priceForPeriod({...pkg,planCode:plan},period):null;}catch{return bankError(req,"Invalid billing period",400);}if("termPrices" in pkg&&pkg.termPrices!=="{}"&&typeof body.quoteId!=="string")return bankError(req,"PRICE_QUOTE_REQUIRED",400);
 if(configured){months=configured.months;days=configured.days;if(typeof body.quoteId!=="string")return bankError(req,"PRICE_QUOTE_REQUIRED",400);}
 const rates=await getFxRates();
 const rial=body.currency==="IRR";
 const bank=await bankSettings();
 bank.currency=body.currency==="EUR"?"EUR":"TRY";
 if(body.currency === "EUR") { bank.currency="EUR"; bank.iban=bank.euroIban; }
 if(body.currency === "USD") { bank.currency="USD"; bank.iban=bank.euroIban; }
 if(!rial&&(!validIban(bank.iban)||!["TRY","EUR","USD"].includes(bank.currency)))return bankError(req,"Bank account is unavailable",503);
 const usd=packageUsdPrice(pkg,rates);
 const promo=tier?{percent:0,code:null}:await referralDiscount(user.id);
 const originalTotal=configured?configured.minor/(configured.currency==="IRT"?1:100)/(configured.currency==="TRY"?rates.usdToTry:configured.currency==="IRT"?rates.usdToToman:1):usd*priceMultiplier*(1-discount);
 // Prices in other currencies are converted with the stored FX rates; if the
 // rate sync has not run (or failed) the total is NaN and applyPromo threw,
 // which surfaced to the customer as a bare 500 at checkout.
 if(!Number.isFinite(originalTotal)||originalTotal<0)return bankError(req,"Prices are being updated. Please try again in a few minutes.",503);
 const total=applyPromo(originalTotal,promo.percent);
 let amount=tier&&rial?tier.priceToman:Math.round(total*rates.usdToToman);
 const currency=rial?"IRR":bank.currency;
 const gateway=rial?"zarinpal":"bank_transfer";
 // transferMinor is reserved for foreign-currency cents; rial is converted by the gateway adapter.
 let minor=rial?0:Math.round(total*(bank.currency==="TRY"?rates.usdToTry:bank.currency==="EUR"?rates.usdToEur:1)*100);
 let quote=null;let quoteSnapshot:{credits:number;days:number;category?:string;mediaCredits?:number;voiceMinutes?:number;entitlements?:unknown;originalAmountToman?:number;promo?:{percent:number;code:string|null};base:{months:number};teamSeatLimit:number|null;crmSeatLimit:number|null;bonus?:{id:string;days:number;credits:number}|null}|null=null;
 if(body.quoteId){quote=await prisma.billingQuote.findFirst({where:{id:body.quoteId,userId:user.id,planCode:plan,period}});if(!quote||quote.expiresAt<=new Date()||quote.paymentId)return bankError(req,"QUOTE_EXPIRED",409);const expectedCurrency=rial?"IRT":bank.currency;if(quote.currency!==expectedCurrency)return bankError(req,"QUOTE_CURRENCY_MISMATCH",400);amount=quote.amountToman;minor=rial?0:quote.amountMinor;quoteSnapshot=JSON.parse(quote.snapshot);if(quoteSnapshot){days=quoteSnapshot.days;months=quoteSnapshot.base.months;}}
 if(!Number.isSafeInteger(amount)||amount<=0||amount>2147483647||!Number.isSafeInteger(minor)||minor>2147483647||(!rial&&minor<=0))return bankError(req,"Package price unavailable",400);
 // A Zarinpal link lives 15 minutes: an older unpaid order for the same package is closed
 // (after asking Zarinpal) instead of sending the buyer back to its dead link.
 if(rial)for(const stale of await prisma.payment.findMany({where:{userId:user.id,plan,status:"PENDING",gateway:"zarinpal",authority:{not:null},createdAt:{lt:new Date(Date.now()-15*60000)}},select:{id:true,authority:true}}))await closeAbandonedGatewayOrder(stale.id,stale.authority!);
 try {
 const payment=await prisma.$transaction(async tx=>{
  if(quote){const claimed=await tx.billingQuote.updateMany({where:{id:quote.id,paymentId:null,expiresAt:{gt:new Date()}},data:{paymentId:`reserved-${quote.id}`}});if(!claimed.count)throw Error("QUOTE_ALREADY_USED");}
  const pending=await tx.payment.findFirst({where:{userId:user.id,plan,...(rial?{amount}:{}),periodMonths:months,transferCurrency:currency,transferMinor:rial?undefined:minor,status:"PENDING",gateway}});
  if(pending&&(!rial||pending.authority)){if(quote)await tx.billingQuote.update({where:{id:quote.id},data:{paymentId:pending.id}});return pending;}
  if(pending)throw new Error("PAYMENT_PROCESSING");
  if((quoteSnapshot?.promo?.percent??promo.percent)>0&&await tx.payment.findFirst({where:{userId:user.id,status:"SUCCESS"}}))throw Error("PROMOTION_NO_LONGER_ELIGIBLE");
  if((quoteSnapshot?.promo?.percent??promo.percent)>0 && await tx.payment.findFirst({where:{userId:user.id,status:"PENDING",promoPercent:{gt:0}}}))throw new Error("PROMO_ORDER_PENDING");
  if(intro&&await tx.payment.findFirst({where:{userId:user.id,plan:{startsWith:"STUDENT_"},status:{in:["PENDING","SUCCESS"]}}}))throw new Error("OFFER_USED");
  const created=await tx.payment.create({data:{promoCode:quoteSnapshot?.promo?.code??promo.code,promoPercent:quoteSnapshot?.promo?.percent??promo.percent,originalAmount:quoteSnapshot?.originalAmountToman??(tier?tier.priceToman:Number.isFinite(originalTotal*rates.usdToToman)&&originalTotal*rates.usdToToman<=2147483647?Math.round(originalTotal*rates.usdToToman):null),userId:user.id,plan,status:"PENDING",gateway,amount,periodMonths:months,transferCurrency:currency,transferMinor:minor,bankSnapshot:JSON.stringify({iban:bank.iban,holder:bank.holder,rateDate:rates.rateDate}),entitlementSnapshot:JSON.stringify({...(MODULE_RETURN_PATHS.includes(body.returnPath)?{returnPath:body.returnPath}:{}),...(tier&&body.context==="FITNESS"?{returnPath:"/fitness/credits"}:{}),...(quoteSnapshot?{quote:quoteSnapshot}:{}),...("category" in pkg&&pkg.category==="CHAT_STARTER"?{returnPath:"/chat"}:{}),category:quoteSnapshot?.category??("category" in pkg?pkg.category:undefined),mediaCredits:quoteSnapshot?.mediaCredits??("mediaCredits" in pkg?pkg.mediaCredits:0),voiceMinutes:quoteSnapshot?.voiceMinutes??("voiceMinutes" in pkg?pkg.voiceMinutes:0),entitlements:quoteSnapshot?.entitlements??("entitlements" in pkg?JSON.parse(pkg.entitlements):undefined),credits:quoteSnapshot?quoteSnapshot.credits:pkg.credits * (isBusinessBundle(plan) ? months : 1),businessBundle:isBusinessBundle(plan),...(plan.startsWith("STUDENT_")?{accountType:"STUDENT"}:{}),days,crmSeatLimit:quoteSnapshot?quoteSnapshot.crmSeatLimit:pkg.crmSeatLimit,teamSeatLimit:quoteSnapshot?quoteSnapshot.teamSeatLimit:pkg.teamSeatLimit})}});
  if(quote)await tx.billingQuote.update({where:{id:quote.id},data:{paymentId:created.id}});
  if(quoteSnapshot?.bonus){const bonus=quoteSnapshot.bonus;const promotion=await tx.billingPromotion.findUniqueOrThrow({where:{id:bonus.id}});if(await tx.billingPromotionRedemption.findFirst({where:{userId:user.id}}))throw Error("PROMOTION_ORDER_PENDING");if(!promotion.enabled||promotion.endsAt<=new Date()||await tx.payment.findFirst({where:{userId:user.id,status:"SUCCESS"}})||await tx.billingPromotionRedemption.count({where:{promotionId:bonus.id}})>=promotion.maxRedemptions)throw Error("PROMOTION_NO_LONGER_ELIGIBLE");await tx.billingPromotionRedemption.create({data:{promotionId:bonus.id,userId:user.id,paymentId:created.id}});}
  return created;
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
   if(quoteSnapshot?.bonus)await releaseFailedPromotion(payment.id);
   return bankError(req,"Payment gateway unavailable",503);
  }
 }
 return NextResponse.json({paymentId:payment.id,paymentUrl:`${("category" in pkg&&pkg.category==="FITNESS")||body.context==="FITNESS"?"/fitness/checkout":"/checkout"}/${payment.id}`});
 }catch(e){if(e instanceof Error&&["QUOTE_ALREADY_USED","PROMOTION_NO_LONGER_ELIGIBLE","PROMOTION_ORDER_PENDING"].includes(e.message))return bankError(req,e.message,409);if(e instanceof Error&&e.message==="PROMO_ORDER_PENDING")return bankError(req,"Complete or cancel the existing discounted order first",409);if(e instanceof Error&&e.message==="PAYMENT_PROCESSING")return bankError(req,"Payment is processing",409);if(e instanceof Error&&e.message==="OFFER_USED")return bankError(req,"Student welcome offer already used",409);throw e;}
}
