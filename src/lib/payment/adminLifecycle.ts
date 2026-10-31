import {prisma} from "@/lib/db/prisma";
import {settleMarketOrder} from "@/lib/fitness/marketplace";
import {savedGatewayUrl} from "./tracking";
import {verifyPayment} from "./zarinpal";
import {settleVerifiedPayment} from "./reviewBankPayment";
export class PaymentLifecycleError extends Error{constructor(public code:string,public status=409){super(code);}}
/**
 * Closes an unpaid Zarinpal order the buyer abandoned (returned with NOK, or
 * a link past its 15-minute life): Zarinpal is asked first, so a payment that
 * did go through is settled instead. Without this the order stayed PENDING and
 * buying again reopened its dead gateway link.
 */
export async function closeAbandonedGatewayOrder(id:string,authority:string){
 const p=await prisma.payment.findUnique({where:{id},select:{status:true,gateway:true,authority:true}});
 if(!p||p.status!=="PENDING"||p.gateway!=="zarinpal"||p.authority!==authority)return null;
 // Closed as FAILED ("payment not completed"), not CANCELLED: the buyer's history must not read "cancelled by administrator".
 try{return (await manageUnpaidOrder(id,"system:zarinpal-return","cancel","","FAILED")).status;}catch{return null;}
}
export async function manageUnpaidOrder(id:string,actorId:string,action:"cancel"|"continue",note:string,outcome:"CANCELLED"|"FAILED"="CANCELLED"){
 if(action==="cancel"){
  const existing=await prisma.payment.findUnique({where:{id}});
  // A simulated (local) payment was never paid; only a real authority is checked with Zarinpal.
  if(existing?.status==="PENDING"&&existing.gateway==="zarinpal"&&existing.authority&&!(process.env.NODE_ENV!=="production"&&existing.authority.startsWith("DEV_"))){
   let result;try{result=await verifyPayment({authority:existing.authority,amount:existing.amount});}catch{throw new PaymentLifecycleError("GATEWAY_CHECK_REQUIRED",503);}
   if(result.ok&&result.refId){await settleVerifiedPayment(id,existing.authority,result.refId);await prisma.auditLog.create({data:{actorId,action:"payment_gateway_verified_before_cancellation",targetId:id}});return {status:"SUCCESS",url:null};}
   if(![-51,-54].includes(result.code??0))throw new PaymentLifecycleError("GATEWAY_CHECK_REQUIRED",503);
  }
 }
 return prisma.$transaction(async tx=>{
  const payment=await tx.payment.findUnique({where:{id}});
  if(!payment)throw new PaymentLifecycleError("ORDER_NOT_FOUND",404);
  if(action==="cancel"&&payment.status===outcome)return {status:outcome,url:null};
  if(payment.status!=="PENDING"||payment.refId)throw new PaymentLifecycleError("ORDER_NOT_UNPAID");
  if(action==="continue"){
   const url=payment.gateway==="bank_transfer"?`/checkout/${payment.id}`:savedGatewayUrl(payment.gateway,payment.bankSnapshot);
   if(!url)throw new PaymentLifecycleError("PAYMENT_LINK_UNAVAILABLE");
   await tx.auditLog.create({data:{actorId,action:"payment_continuation_requested",targetId:id}});
   return {status:"PENDING",url};
  }
  if(payment.receiptAt)throw new PaymentLifecycleError("RECEIPT_REQUIRES_REVIEW");
  const claimed=await tx.payment.updateMany({where:{id,status:"PENDING",receiptAt:null,refId:null},data:outcome==="CANCELLED"?{status:"CANCELLED",reviewBy:actorId,reviewAt:new Date(),reviewNote:note}:{status:"FAILED"}});
  if(!claimed.count)throw new PaymentLifecycleError("ORDER_CHANGED");
  if(payment.plan==="FIT_MARKETPLACE")await settleMarketOrder(tx,id,false);
  await tx.billingPromotionRedemption.deleteMany({where:{paymentId:id}});
  await tx.auditLog.create({data:{actorId,action:"unpaid_order_cancelled",targetId:id,metadata:JSON.stringify({note,gateway:payment.gateway,outcome})}});
  return {status:outcome,url:null};
 });
}
