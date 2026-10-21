import {beforeAll,afterAll,it,expect} from "vitest";
import {prisma} from "@/lib/db/prisma";
import {releaseFailedPromotion} from "./releasePromotion";
const uid="promo-release-qa",promotionId="promo-release-test";
beforeAll(async()=>{await prisma.user.upsert({where:{id:uid},create:{id:uid,email:uid+"@invalid.example"},update:{}});await prisma.billingPromotion.create({data:{id:promotionId,name:"QA",configuration:"{}",startsAt:new Date(),endsAt:new Date(Date.now()+60000)}});});
afterAll(async()=>{await prisma.auditLog.deleteMany({where:{actorId:uid}});await prisma.billingPromotionRedemption.deleteMany({where:{userId:uid}});await prisma.payment.deleteMany({where:{userId:uid}});await prisma.billingPromotion.deleteMany({where:{id:promotionId}});await prisma.user.deleteMany({where:{id:uid}});});
it("releases a failed reservation once and preserves its audit trail",async()=>{
 const payment=await prisma.payment.create({data:{userId:uid,plan:"FIT_MONTHLY",amount:100,status:"FAILED"}});
 await prisma.billingPromotionRedemption.create({data:{userId:uid,promotionId,paymentId:payment.id}});
 expect(await releaseFailedPromotion(payment.id)).toBe(true);expect(await releaseFailedPromotion(payment.id)).toBe(false);
 expect(await prisma.billingPromotionRedemption.count({where:{paymentId:payment.id}})).toBe(0);
 expect(await prisma.auditLog.count({where:{targetId:payment.id,action:"billing_promotion_reservation_released"}})).toBe(1);
});
it("does not release a pending or successful purchase",async()=>{
 for(const status of ["PENDING","SUCCESS"]){const p=await prisma.payment.create({data:{userId:uid,plan:"FIT_MONTHLY",amount:100,status}});await prisma.billingPromotionRedemption.create({data:{userId:uid,promotionId,paymentId:p.id}});expect(await releaseFailedPromotion(p.id)).toBe(false);expect(await prisma.billingPromotionRedemption.count({where:{paymentId:p.id}})).toBe(1);await prisma.billingPromotionRedemption.delete({where:{paymentId:p.id}});}
});
