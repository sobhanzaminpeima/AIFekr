import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { reviewBankPayment } from "./reviewBankPayment";
import { validIban } from "./bank";
describe.runIf(process.env.RUN_BANK_INTEGRATION === "1")("bank transaction integration",()=>{
let buyer:string,referrer:string,admin:string;
beforeAll(async()=>{
 if(process.env.DATABASE_URL!=="file:/private/tmp/aifekr-test.db")throw new Error("Isolated integration DB required");
 referrer=(await prisma.user.create({data:{email:`bank-ref-${Date.now()}@test.invalid`,commissionPercentOverride:15}})).id;
 buyer=(await prisma.user.create({data:{email:`bank-buyer-${Date.now()}@test.invalid`,referredBy:referrer}})).id;
 admin=(await prisma.user.create({data:{email:`bank-admin-${Date.now()}@test.invalid`,role:"ADMIN"}})).id;
});
afterAll(async()=>{if(!buyer)return;await prisma.walletTransaction.deleteMany({where:{userId:referrer}});await prisma.payment.deleteMany({where:{userId:buyer}});await prisma.userModuleOverride.deleteMany({where:{userId:buyer}});await prisma.user.deleteMany({where:{id:{in:[buyer,referrer,admin]}}});});
async function purchase(plan="STUDENT_FIRST_TWO_MONTHS",receipt=true){return prisma.payment.create({data:{userId:buyer,plan,gateway:"bank_transfer",amount:10000,transferMinor:8000,transferCurrency:"TRY",receiptAt:receipt?new Date():null,entitlementSnapshot:JSON.stringify({credits:1000,days:60})}});}
it("validates both supplied IBANs and rejects altered checksum",()=>{expect(validIban("TR210001009010583132105001")).toBe(true);expect(validIban("TR910001009010583132105002")).toBe(true);expect(validIban("TR210001009010583132105002")).toBe(false);});
it("requires a receipt before approval",async()=>{const p=await purchase(undefined,false);await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("NOT_REVIEWABLE");expect((await prisma.payment.findUniqueOrThrow({where:{id:p.id}})).status).toBe("PENDING");});
it("activates and grants commission once, duplicate approval cannot double credit",async()=>{const p=await purchase();const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});await reviewBankPayment(p.id,admin,true,"Verified statement");await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("ALREADY_REVIEWED");const u=await prisma.user.findUniqueOrThrow({where:{id:buyer}});expect(u.credits-before.credits).toBe(1100);expect(u.plan).toBe(p.plan);expect(u.planExpiry!.getTime()-Date.now()).toBeGreaterThan(59*86400000);expect((await prisma.user.findUniqueOrThrow({where:{id:referrer}})).walletBalance).toBe(1500);expect(await prisma.walletTransaction.count({where:{relatedPaymentId:p.id}})).toBe(1);});
it("rejects without activation and cannot approve rejected purchases",async()=>{const p=await purchase();const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});await reviewBankPayment(p.id,admin,false,"Transfer not found");await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("ALREADY_REVIEWED");expect((await prisma.user.findUniqueOrThrow({where:{id:buyer}})).credits).toBe(before.credits);});
it("rolls back status if entitlement is corrupt",async()=>{const p=await purchase();await prisma.payment.update({where:{id:p.id},data:{entitlementSnapshot:'{"credits":-1,"days":60}'}});await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("INVALID_ENTITLEMENT");expect((await prisma.payment.findUniqueOrThrow({where:{id:p.id}})).status).toBe("PENDING");});

});
