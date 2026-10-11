import {prisma} from "@/lib/db/prisma";
export async function releaseFailedPromotion(paymentId:string){
 return prisma.$transaction(async tx=>{
  const payment=await tx.payment.findUnique({where:{id:paymentId}});
  if(!payment||!["FAILED","REJECTED"].includes(payment.status))return false;
  const reserved=await tx.billingPromotionRedemption.findUnique({where:{paymentId}});
  if(!reserved)return false;
  await tx.billingPromotionRedemption.delete({where:{paymentId}});
  await tx.auditLog.create({data:{actorId:payment.userId,action:"billing_promotion_reservation_released",targetId:paymentId,metadata:JSON.stringify({promotionId:reserved.promotionId,reason:payment.status})}});
  return true;
 });
}
