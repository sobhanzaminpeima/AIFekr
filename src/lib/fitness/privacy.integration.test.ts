import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/db/prisma";
const uid="fit-privacy-qa",other="fit-privacy-other";
vi.mock("@/lib/auth/middleware",()=>({requireAuth:vi.fn(async()=>({id:"fit-privacy-qa",role:"USER"})),unauthorizedResponse:vi.fn()}));
vi.mock("@/lib/utils/rateLimit",()=>({rateLimit:()=>({allowed:true})}));
import {POST} from "@/app/api/fitness/route";
const request=(body:unknown)=>new NextRequest("http://localhost/api/fitness",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeAll(async()=>{
 await prisma.user.createMany({data:[{id:uid,email:uid+"@invalid.example",credits:42},{id:other,email:other+"@invalid.example"}]});
 await prisma.fitnessProfile.create({data:{userId:uid,age:25,goal:"Fitness",limitations:"QA note",consentAt:new Date(),entitlementExpiry:new Date("2020-01-01")}});
 await prisma.fitnessDiary.createMany({data:[{userId:uid,day:new Date(),kind:"NOTE",content:"Owned note"},{userId:other,day:new Date(),kind:"NOTE",content:"Other private note"}]});
});
afterAll(async()=>{await prisma.auditLog.deleteMany({where:{targetId:uid}});await prisma.user.deleteMany({where:{id:{in:[uid,other]}}});});
it("expired users can export their own data without exposing another account",async()=>{
 const response=await POST(request({action:"export"}));expect(response.status).toBe(200);
 const data=await response.json();expect(data.diary).toHaveLength(1);expect(data.diary[0].userId).toBe(uid);
 expect((await POST(request({action:"export",userId:other}))).status).toBe(409);
});
it("deletion requires explicit confirmation and preserves subscription and wallets",async()=>{
 expect((await POST(request({action:"deleteHealthData",confirm:false}))).status).toBe(409);
 expect(await prisma.fitnessDiary.count({where:{userId:uid}})).toBe(1);
 expect((await POST(request({action:"deleteHealthData",confirm:true}))).status).toBe(200);
 expect(await prisma.fitnessDiary.count({where:{userId:uid}})).toBe(0);
 expect(await prisma.fitnessDiary.count({where:{userId:other}})).toBe(1);
 const profile=await prisma.fitnessProfile.findUniqueOrThrow({where:{userId:uid}});
 expect(profile.limitations).toBe("");expect(profile.entitlementExpiry?.getUTCFullYear()).toBe(2020);
 expect((await prisma.user.findUniqueOrThrow({where:{id:uid}})).credits).toBe(42);
 expect(await prisma.auditLog.count({where:{actorId:uid,action:"fitness_health_history_deleted"}})).toBe(1);
});
