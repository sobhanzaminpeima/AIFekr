import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { reviewBankPayment, settleVerifiedPayment } from "./reviewBankPayment";
import { validIban } from "./bank";
describe.runIf(process.env.RUN_BANK_INTEGRATION === "1")("bank transaction integration",()=>{
let buyer:string,referrer:string,admin:string;
beforeAll(async()=>{
 if(!["file:/private/tmp/aifekr-test.db", "file:./vitest.db"].includes(process.env.DATABASE_URL || ""))throw new Error("Isolated integration DB required");
 referrer=(await prisma.user.create({data:{email:`bank-ref-${Date.now()}@test.invalid`,commissionPercentOverride:15}})).id;
 buyer=(await prisma.user.create({data:{email:`bank-buyer-${Date.now()}@test.invalid`,referredBy:referrer}})).id;
 admin=(await prisma.user.create({data:{email:`bank-admin-${Date.now()}@test.invalid`,role:"ADMIN"}})).id;
});
afterAll(async()=>{if(!buyer)return;await prisma.walletTransaction.deleteMany({where:{userId:referrer}});await prisma.payment.deleteMany({where:{userId:buyer}});await prisma.userModuleOverride.deleteMany({where:{userId:buyer}});await prisma.user.deleteMany({where:{id:{in:[buyer,referrer,admin]}}});});
async function purchase(plan="STUDENT_FIRST_TWO_MONTHS",receipt=true){return prisma.payment.create({data:{userId:buyer,plan,gateway:"bank_transfer",amount:10000,transferMinor:8000,transferCurrency:"TRY",receiptAt:receipt?new Date():null,entitlementSnapshot:JSON.stringify({credits:1000,days:60})}});}
it("validates both supplied IBANs and rejects altered checksum",()=>{expect(validIban("TR210001009010583132105001")).toBe(true);expect(validIban("TR910001009010583132105002")).toBe(true);expect(validIban("TR210001009010583132105002")).toBe(false);});
it("grants the new offer's snapshotted 90 days without multiplying its credits",async()=>{
 const p=await purchase("STUDENT_FIRST_THREE_MONTHS");
 await prisma.payment.update({where:{id:p.id},data:{entitlementSnapshot:JSON.stringify({credits:1000,days:90})}});
 await prisma.user.update({where:{id:buyer},data:{planExpiry:null,referralRewarded:true}});
 const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});
 await reviewBankPayment(p.id,admin,true,"Student offer verified");
 const after=await prisma.user.findUniqueOrThrow({where:{id:buyer}});
 expect(Math.round((after.planExpiry!.getTime()-Date.now())/86400000)).toBe(90);
 expect(after.credits-before.credits).toBe(1000);
 await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("ALREADY_REVIEWED");
 await prisma.user.update({where:{id:buyer},data:{planExpiry:null,referralRewarded:false}});
});
it("requires a receipt before approval",async()=>{const p=await purchase(undefined,false);await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("NOT_REVIEWABLE");expect((await prisma.payment.findUniqueOrThrow({where:{id:p.id}})).status).toBe("PENDING");});
it("activates and grants commission once, duplicate approval cannot double credit",async()=>{const p=await purchase();const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});await reviewBankPayment(p.id,admin,true,"Verified statement");await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("ALREADY_REVIEWED");const u=await prisma.user.findUniqueOrThrow({where:{id:buyer}});expect(u.credits-before.credits).toBe(1100);expect(u.plan).toBe(p.plan);expect(u.planExpiry!.getTime()-Date.now()).toBeGreaterThan(59*86400000);expect((await prisma.user.findUniqueOrThrow({where:{id:referrer}})).walletBalance).toBe(1500);expect(await prisma.walletTransaction.count({where:{relatedPaymentId:p.id}})).toBe(1);});
it("rejects without activation and cannot approve rejected purchases",async()=>{const p=await purchase();const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});await reviewBankPayment(p.id,admin,false,"Transfer not found");await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("ALREADY_REVIEWED");expect((await prisma.user.findUniqueOrThrow({where:{id:buyer}})).credits).toBe(before.credits);});
it("rolls back status if entitlement is corrupt",async()=>{const p=await purchase();await prisma.payment.update({where:{id:p.id},data:{entitlementSnapshot:'{"credits":-1,"days":60}'}});await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("INVALID_ENTITLEMENT");expect((await prisma.payment.findUniqueOrThrow({where:{id:p.id}})).status).toBe("PENDING");});

it("activates the full business workspace atomically and expires module access",async()=>{
 const { isModuleEnabled, getModuleAccessMap } = await import("@/lib/industry/moduleAccess");
 const { hasBusinessBundle } = await import("@/lib/plans/businessAccess");
 const p=await purchase("TEAM_BUSINESS_START");
 await prisma.payment.update({where:{id:p.id},data:{entitlementSnapshot:JSON.stringify({credits:12000,days:90,teamSeatLimit:3,crmSeatLimit:3,businessBundle:true})}});
 expect(await hasBusinessBundle(buyer)).toBe(false);
 await reviewBankPayment(p.id,admin,true,"Verified business transfer");
 const u=await prisma.user.findUniqueOrThrow({where:{id:buyer}});
 expect(u.plan).toBe("TEAM");expect(u.crmPlan).toBe("TEAM");expect(u.voicePlan).toBe("NONE");
 expect(u.crmPlanExpiry).toEqual(u.planExpiry);expect(u.voicePlanExpiry).toBeNull();
 const team=await prisma.team.findUniqueOrThrow({where:{ownerId:buyer}});
 expect(team.maxSeats).toBe(3);expect(team.credits).toBe(12000);
 expect(await isModuleEnabled({id:buyer,role:"USER",industryPackId:null},"agent.leadMatcher")).toBe(true);
 expect(await getModuleAccessMap({id:buyer,role:"USER",industryPackId:null},["crm.property","agent.voiceCallCenter"])).toEqual({"crm.property":true,"agent.voiceCallCenter":false});
 await expect(reviewBankPayment(p.id,admin,true,"")).rejects.toThrow("ALREADY_REVIEWED");
 expect((await prisma.team.findUniqueOrThrow({where:{ownerId:buyer}})).credits).toBe(12000);
 await prisma.user.update({where:{id:buyer},data:{planExpiry:new Date(Date.now()-86400000)}});
 expect(await hasBusinessBundle(buyer)).toBe(false);
 expect(await isModuleEnabled({id:buyer,role:"USER",industryPackId:null},"crm.property")).toBe(false);
});

it("includes AI Call Center in Growth and Scale",async()=>{
 for(const plan of ["TEAM_BUSINESS_GROW","TEAM_BUSINESS_SCALE"]){const p=await purchase(plan);await prisma.payment.update({where:{id:p.id},data:{entitlementSnapshot:JSON.stringify({credits:1000,days:30,teamSeatLimit:plan.endsWith("GROW")?10:25,crmSeatLimit:10,businessBundle:true})}});await reviewBankPayment(p.id,admin,true,"");const u=await prisma.user.findUniqueOrThrow({where:{id:buyer}});expect(u.voicePlan).toBe("ACTIVE");expect(u.voicePlanExpiry).toEqual(u.planExpiry);}
});
it("preserves a separately paid voice add-on when buying Launch",async()=>{
 const voice=await purchase("VOICE_MONTHLY");await prisma.payment.update({where:{id:voice.id},data:{entitlementSnapshot:JSON.stringify({credits:0,days:30})}});await reviewBankPayment(voice.id,admin,true,"");
 const p=await purchase("TEAM_BUSINESS_START");await prisma.payment.update({where:{id:p.id},data:{entitlementSnapshot:JSON.stringify({credits:1000,days:30,teamSeatLimit:3,crmSeatLimit:3,businessBundle:true})}});await reviewBankPayment(p.id,admin,true,"");expect((await prisma.user.findUniqueOrThrow({where:{id:buyer}})).voicePlan).toBe("ACTIVE");
});

it("binds verified gateway activation to its authority and grants credits only once",async()=>{
 const p=await purchase("CREDITS_test",false);
 await prisma.payment.update({where:{id:p.id},data:{gateway:"zarinpal",authority:"TEST_VERIFIED_GATEWAY",entitlementSnapshot:JSON.stringify({credits:750,days:30})}});
 const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});
 await expect(settleVerifiedPayment(p.id,"WRONG_AUTHORITY","123")).rejects.toThrow("NOT_REVIEWABLE");
 expect(await settleVerifiedPayment(p.id,"TEST_VERIFIED_GATEWAY","123")).toBe(true);
 expect(await settleVerifiedPayment(p.id,"TEST_VERIFIED_GATEWAY","123")).toBe(false);
 const after=await prisma.user.findUniqueOrThrow({where:{id:buyer}});
 expect(after.credits-before.credits).toBe(750);expect(after.plan).toBe(before.plan);expect(after.planExpiry).toEqual(before.planExpiry);
});

});
