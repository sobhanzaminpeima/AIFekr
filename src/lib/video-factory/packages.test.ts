import {describe,it,expect,vi} from "vitest";
import type {Prisma} from "@prisma/client";
import {claimPackage,settlementCredits} from "./packages";
const now=new Date("2026-10-18T00:00:00Z");
function db(jobs:unknown[]=[],status="SUCCESS"){
 return {payment:{findMany:vi.fn(async()=>status==="SUCCESS"?[{id:"paid",createdAt:now,reviewAt:now,entitlementSnapshot:JSON.stringify({category:"VIDEO_FACTORY",days:30,entitlements:{limits:{videoCount:2,videoSeconds:720,videoMaxSeconds:480}}})}]:[])},videoFactoryJob:{findMany:vi.fn(async()=>jobs)}} as unknown as Prisma.TransactionClient;
}
describe("Paid video package authorization",()=>{
 it("requires a verified purchase",async()=>{await expect(claimPackage(db([],"PENDING"),"u",360,now)).rejects.toThrow("VIDEO_PACKAGE_REQUIRED");});
 it("enforces the hard eight-minute maximum",async()=>{await expect(claimPackage(db(),"u",481,now)).rejects.toThrow("VIDEO_MAXIMUM");});
 it("uses historical purchase limits and counts reserved minutes",async()=>{const tx=db([{policy:JSON.stringify({packageUsage:{paymentId:"paid",seconds:480}})}]);await expect(claimPackage(tx,"u",360,now)).rejects.toThrow("EXHAUSTED");expect(await claimPackage(tx,"u",240,now)).toEqual({paymentId:"paid",seconds:240});});
 it("enforces count even when minutes remain",async()=>{await expect(claimPackage(db(Array(2).fill({policy:JSON.stringify({packageUsage:{paymentId:"paid",seconds:30}})})),"u",30,now)).rejects.toThrow("EXHAUSTED");});
 it("does not count another purchase's work",async()=>{expect(await claimPackage(db([{policy:JSON.stringify({packageUsage:{paymentId:"other",seconds:480}})}]),"u",360,now)).toEqual({paymentId:"paid",seconds:360});});
 it("rejects expired purchases",async()=>{await expect(claimPackage(db(),"u",60,new Date("2026-12-01"))).rejects.toThrow("EXHAUSTED");});
 it("refunds all reserved credits for technical failure",()=>{expect(settlementCredits("FAILED",900,700)).toEqual({charged:0,refund:900});});
 it("preserves completed work charges on user cancellation",()=>{expect(settlementCredits("CANCELLED",900,700)).toEqual({charged:700,refund:200});});
});
