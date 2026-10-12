import {prisma} from "@/lib/db/prisma";
import {Prisma} from "@prisma/client";
import {currencyConvert} from "@/lib/billing/rates";
import {bankSettings,validIban} from "@/lib/payment/bank";
import {createPayment} from "@/lib/payment/zarinpal";
import {publicAppUrl} from "@/lib/utils/publicAppUrl";
import {savedGatewayUrl} from "@/lib/payment/tracking";
import {fitnessAccess} from "./service";
export async function marketplaceCheckout(userId:string,role:string,input:{productId?:string;slotId?:string;quantity:number;currency:"TRY"|"EUR"|"IRR";clientKey:string;shippingAddress?:string}){
 const old=await prisma.fitnessMarketOrder.findUnique({where:{userId_clientKey:{userId,clientKey:input.clientKey}},include:{booking:true}});if(old){if(old.productId!==(input.productId||null)||old.booking?.slotId!==input.slotId||old.quantity!==input.quantity||old.currency!==(input.currency==="IRR"?"IRT":input.currency))throw Error("IDEMPOTENCY_MISMATCH");return old;}
 if(!await fitnessAccess(userId,role))throw Error("FITNESS_SUBSCRIPTION_REQUIRED");
 const product=input.productId?await prisma.fitnessProduct.findUniqueOrThrow({where:{id:input.productId},include:{trainer:true}}):null;
 const slot=input.slotId?await prisma.fitnessAvailability.findUniqueOrThrow({where:{id:input.slotId},include:{trainer:true}}):null;
 const trainer=product?.trainer||slot?.trainer;if(!trainer||trainer.status!=="ACTIVE"||trainer.type!=="HUMAN"||!trainer.consentAt||trainer.userId===userId)throw Error("TRAINER_UNAVAILABLE");
 if(product&&(product.status!=="PUBLISHED"||!["DIGITAL","PHYSICAL"].includes(product.kind)))throw Error("PRODUCT_UNAVAILABLE");
 if(slot&&(slot.status!=="OPEN"||slot.startsAt<=new Date()||input.quantity!==1))throw Error("SLOT_UNAVAILABLE");
 if(product?.kind==="PHYSICAL"&&!input.shippingAddress?.trim())throw Error("SHIPPING_ADDRESS_REQUIRED");
 const base=(product?.priceMinor??slot!.priceMinor)*input.quantity,baseCurrency=product?.currency??slot!.currency;
 const [foreign,toman,bank]=await Promise.all([currencyConvert(base,baseCurrency,input.currency==="IRR"?"IRT":input.currency),currencyConvert(base,baseCurrency,"IRT"),bankSettings()]);
 const iban=input.currency==="EUR"?bank.euroIban:bank.iban;if((input.currency!=="IRR"&&!validIban(iban))||foreign.minor<=0||toman.minor<=0)throw Error("PAYMENT_CONFIGURATION_REQUIRED");
 return prisma.$transaction(async tx=>{
  const duplicate=await tx.fitnessMarketOrder.findUnique({where:{userId_clientKey:{userId,clientKey:input.clientKey}}});if(duplicate)return duplicate;
  await tx.fitnessTrainer.findFirstOrThrow({where:{id:trainer.id,status:"ACTIVE",type:"HUMAN",consentAt:{not:null}}});
  if(await tx.fitnessMarketOrder.count({where:{userId,status:"AWAITING_PAYMENT"}})>=3)throw Error("PENDING_ORDER_LIMIT");
  if(product){const claimed=await tx.fitnessProduct.updateMany({where:{id:product.id,status:"PUBLISHED",priceMinor:product.priceMinor,currency:product.currency,...(product.kind==="PHYSICAL"?{inventory:{gte:input.quantity}}:{})},data:product.kind==="PHYSICAL"?{inventory:{decrement:input.quantity}}:{status:"PUBLISHED"}});if(!claimed.count)throw Error("PRODUCT_CHANGED_OR_OUT_OF_STOCK");}
  if(slot){const claimed=await tx.fitnessAvailability.updateMany({where:{id:slot.id,status:"OPEN",priceMinor:slot.priceMinor,currency:slot.currency},data:{status:"HELD"}});if(!claimed.count)throw Error("SLOT_UNAVAILABLE");}
  const snapshot={title:product?.title||trainer.name,kind:product?.kind||"BOOKING",digitalAsset:product?.digitalAsset,startsAt:slot?.startsAt,endsAt:slot?.endsAt,trainerName:trainer.name,baseMinor:base,baseCurrency,rates:foreign.rates};
  const payment=await tx.payment.create({data:{userId,plan:"FIT_MARKETPLACE",amount:toman.minor,gateway:input.currency==="IRR"?"zarinpal":"bank_transfer",transferCurrency:input.currency,transferMinor:input.currency==="IRR"?0:foreign.minor,bankSnapshot:JSON.stringify({iban,holder:bank.holder}),entitlementSnapshot:JSON.stringify({category:"FIT_MARKETPLACE",returnPath:"/fitness/marketplace",credits:0,days:1})}});
  const booking=slot?await tx.fitnessBooking.create({data:{userId,trainerId:trainer.id,slotId:slot.id,paymentId:payment.id}}):null;
  return tx.fitnessMarketOrder.create({data:{userId,trainerId:trainer.id,productId:product?.id,bookingId:booking?.id,paymentId:payment.id,clientKey:input.clientKey,quantity:input.quantity,totalMinor:foreign.minor,currency:input.currency==="IRR"?"IRT":input.currency,snapshot:JSON.stringify(snapshot),shippingAddress:product?.kind==="PHYSICAL"?input.shippingAddress:undefined}});
 });
}
export async function settleMarketOrder(tx:Prisma.TransactionClient,paymentId:string,approved:boolean){
 const order=await tx.fitnessMarketOrder.findUniqueOrThrow({where:{paymentId},include:{booking:true,product:true}});
 if(order.status!=="AWAITING_PAYMENT")throw Error("ORDER_ALREADY_SETTLED");
 const snapshot=JSON.parse(order.snapshot);
 await tx.fitnessMarketOrder.update({where:{id:order.id},data:{status:approved?(snapshot.kind==="DIGITAL"?"DELIVERED":"PAID"):"CANCELLED"}});
 if(order.booking){await tx.fitnessBooking.update({where:{id:order.booking.id},data:{status:approved?"CONFIRMED":"CANCELLED"}});await tx.fitnessAvailability.update({where:{id:order.booking.slotId},data:{status:approved?"BOOKED":"OPEN"}});}
 if(!approved&&snapshot.kind==="PHYSICAL"&&order.productId)await tx.fitnessProduct.update({where:{id:order.productId},data:{inventory:{increment:order.quantity}}});
 if(approved){const p=await tx.payment.findUniqueOrThrow({where:{id:paymentId}});const setting=await tx.siteSetting.findUnique({where:{key:"fitness_marketplace_commission_percent"}});const percent=Number(setting?.value??15);if(!Number.isFinite(percent)||percent<0||percent>100)throw Error("INVALID_MARKETPLACE_COMMISSION");const fee=Math.round(p.amount*percent/100);await tx.fitnessSellerLedger.create({data:{orderId:order.id,trainerId:order.trainerId,kind:"SALE",amountToman:p.amount-fee,status:"HELD",reference:JSON.stringify({gross:p.amount,platformFee:fee,percent})}});}
}

export async function releaseAbandonedMarketOrders(){const rows=await prisma.payment.findMany({where:{plan:"FIT_MARKETPLACE",status:"PENDING",gateway:"bank_transfer",receiptAt:null,createdAt:{lt:new Date(Date.now()-24*3600000)}},select:{id:true},take:100});let released=0;for(const p of rows){await prisma.$transaction(async tx=>{const claimed=await tx.payment.updateMany({where:{id:p.id,status:"PENDING",receiptAt:null},data:{status:"REJECTED",reviewNote:"Unpaid reservation expired after 24 hours"}});if(!claimed.count)return;await settleMarketOrder(tx,p.id,false);await tx.auditLog.create({data:{actorId:"SYSTEM",action:"fitness_unpaid_order_expired",targetId:p.id}});released++;});}return released;}

export async function marketplacePaymentUrl(order:{paymentId:string;userId:string}){
 const p=await prisma.payment.findFirstOrThrow({where:{id:order.paymentId,userId:order.userId,status:"PENDING"}});
 if(p.gateway==="bank_transfer")return "/fitness/checkout/"+p.id;
 const existing=savedGatewayUrl(p.gateway,p.bankSnapshot);if(existing)return existing;
 const reserved="initializing-"+p.id;
 if(!(await prisma.payment.updateMany({where:{id:p.id,status:"PENDING",authority:null},data:{authority:reserved}})).count)throw Error("PAYMENT_PROCESSING");
 try{const url=new URL("/api/payment/verify",publicAppUrl());url.searchParams.set("paymentId",p.id);const result=await createPayment({amount:p.amount,description:"AIFekr FIT marketplace purchase",callbackUrl:url.toString()});if(!result.ok||!result.authority||!result.paymentUrl)throw Error("GATEWAY_UNAVAILABLE");if(!(await prisma.payment.updateMany({where:{id:p.id,status:"PENDING",authority:reserved},data:{authority:result.authority,bankSnapshot:JSON.stringify({paymentUrl:result.paymentUrl})}})).count)throw Error("PAYMENT_STATE_CONFLICT");return result.paymentUrl;}
 catch{await prisma.$transaction(async tx=>{const claimed=await tx.payment.updateMany({where:{id:p.id,status:"PENDING",authority:reserved},data:{status:"FAILED"}});if(claimed.count)await settleMarketOrder(tx,p.id,false);});throw Error("GATEWAY_UNAVAILABLE");}
}
