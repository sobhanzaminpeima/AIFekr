import {beforeAll,afterAll,it,expect} from "vitest";
import {prisma} from "@/lib/db/prisma";
import {getAvailableCredits,chargeAndLog} from "@/lib/utils/teamCredits";
import {reviewBankPayment} from "@/lib/payment/reviewBankPayment";
const owner="fit-pay-owner",buyer="fit-pay-buyer",referrer="fit-pay-referrer",teamId="fit-pay-team";
let paymentId="";
beforeAll(async()=>{
 await prisma.user.createMany({data:[{id:owner,email:owner+"@invalid.example",role:"ADMIN",plan:"TEAM",planExpiry:new Date("2020-01-01")},{id:referrer,email:referrer+"@invalid.example",commissionPercentOverride:10},{id:buyer,email:buyer+"@invalid.example",accountType:"BUSINESS",plan:"TEAM",planExpiry:new Date("2020-01-01"),credits:17,aiCredits:17}]});
 await prisma.user.update({where:{id:buyer},data:{referredBy:referrer}});
 await prisma.team.create({data:{id:teamId,name:"QA expired team",ownerId:owner,credits:5000,planExpiry:new Date("2020-01-01")}});
 await prisma.teamMember.create({data:{teamId,userId:buyer,role:"MEMBER"}});
 await prisma.fitnessProfile.create({data:{userId:buyer,age:25,goal:"General fitness",consentAt:new Date(),entitlementExpiry:new Date(Date.now()+86400000)}});
 const p=await prisma.payment.create({data:{userId:buyer,plan:"FIT_MONTHLY",amount:1000,gateway:"bank_transfer",receiptAt:new Date(),entitlementSnapshot:JSON.stringify({category:"FITNESS",credits:20,days:30,mediaCredits:2,voiceMinutes:4})}});paymentId=p.id;
});
afterAll(async()=>{await prisma.auditLog.deleteMany({where:{actorId:{in:[owner,buyer]},OR:[{targetId:buyer},{targetId:paymentId}]}});await prisma.walletTransaction.deleteMany({where:{userId:{in:[buyer,referrer]}}});await prisma.payment.deleteMany({where:{userId:buyer}});await prisma.teamMember.deleteMany({where:{teamId}});await prisma.team.deleteMany({where:{id:teamId}});await prisma.user.deleteMany({where:{id:{in:[owner,buyer,referrer]}}});});
it("an expired business team does not block the independently active personal FIT wallet",async()=>{expect(await getAvailableCredits(buyer)).toBe(0);expect(await getAvailableCredits(buyer,prisma,"PERSONAL")).toBe(17);});
it("FIT activation grants personal allowances and applies the existing referral reward once",async()=>{
 await reviewBankPayment(paymentId,owner,true,"QA receipt approval");
 const u=await prisma.user.findUniqueOrThrow({where:{id:buyer}});expect(u.credits).toBe(137);expect(u.aiCredits).toBe(37);expect(u.mediaCredits).toBe(2);expect(u.voiceMinutes).toBe(4);expect(u.plan).toBe("TEAM");expect(u.planExpiry?.getUTCFullYear()).toBe(2020);
 expect((await prisma.user.findUniqueOrThrow({where:{id:referrer}})).walletBalance).toBe(100);
 await expect(reviewBankPayment(paymentId,owner,true,"Retry")).rejects.toThrow("ALREADY_REVIEWED");expect((await prisma.user.findUniqueOrThrow({where:{id:buyer}})).credits).toBe(137);
});
it("FIT spending reuses the existing personal wallet and usage ledger without debiting the business team",async()=>{
 expect(await chargeAndLog(buyer,3,{type:"chat",metadata:{feature:"fitness"}},"PERSONAL")).toBe(true);
 expect((await prisma.user.findUniqueOrThrow({where:{id:buyer}})).credits).toBe(134);expect((await prisma.team.findUniqueOrThrow({where:{id:teamId}})).credits).toBe(5000);
 const log=await prisma.usageLog.findFirstOrThrow({where:{userId:buyer,type:"chat"}});expect(log.credits).toBe(3);expect(JSON.parse(log.metadata||"{}").payer).toBe("PERSONAL");
});
