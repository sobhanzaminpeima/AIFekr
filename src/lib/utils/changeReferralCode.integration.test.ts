import {afterAll,beforeAll,describe,it,expect} from "vitest";
import {prisma} from "@/lib/db/prisma";
import {changeReferralCode} from "./changeReferralCode";
import {findUserByReferralCode} from "@/lib/repositories/userRepository";
import {resolvePromo} from "./referralPromo";
describe.runIf(process.env.RUN_REFERRAL_INTEGRATION==="1")("personal referral code ownership",()=>{
 let first:string,second:string;const suffix=Date.now().toString();
 beforeAll(async()=>{
  if(process.env.DATABASE_URL!=="file:./vitest.db")throw Error("Isolated test database required");
  first=(await prisma.user.create({data:{referralCode:`old${suffix}`,referralDiscountPercent:10}})).id;
  second=(await prisma.user.create({data:{referralCode:`other${suffix}`}})).id;
 });
 afterAll(async()=>{await prisma.user.deleteMany({where:{id:{in:[first,second]}}});});
 it("updates the current code and retains the old link and discount owner",async()=>{
  await prisma.$transaction(tx=>changeReferralCode(tx,first,` Sobhan${suffix} `));
  expect(await findUserByReferralCode(`SOBHAN${suffix}`)).toEqual({id:first});
  expect(await findUserByReferralCode(`old${suffix}`)).toEqual({id:first});
  expect(await resolvePromo(`old${suffix}`)).toMatchObject({id:first,referralDiscountPercent:10});
 });
 it("rejects case-insensitive current and former code collisions",async()=>{
  await expect(prisma.$transaction(tx=>changeReferralCode(tx,second,`SOBHAN${suffix}`))).rejects.toThrow("CODE_UNAVAILABLE");
  await expect(prisma.$transaction(tx=>changeReferralCode(tx,second,`old${suffix}`))).rejects.toThrow("CODE_UNAVAILABLE");
 });
 it("allows the owner to restore their former code without losing new shared links",async()=>{
  await prisma.$transaction(tx=>changeReferralCode(tx,first,`old${suffix}`));
  expect(await findUserByReferralCode(`sobhan${suffix}`)).toEqual({id:first});
 });
 it("does not accept unsafe or too-short codes",async()=>{
  await expect(prisma.$transaction(tx=>changeReferralCode(tx,first,"x"))).rejects.toThrow("INVALID_CODE");
  await expect(prisma.$transaction(tx=>changeReferralCode(tx,first,"<sobhan>"))).rejects.toThrow("INVALID_CODE");
 });
});
