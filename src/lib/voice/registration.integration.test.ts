import {afterAll,beforeAll,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/db/prisma";
import {signToken} from "@/lib/auth/jwt";
import {POST as register} from "@/app/api/auth/register/route";
import {GET as users} from "@/app/api/admin/users/route";
import {POST as createAgent} from "@/app/api/voice-agent/agents/route";
import {POST as chat} from "@/app/api/chat/route";
import {POST as buyPackage} from "@/app/api/payment/create/route";
import {GET as home} from "@/app/api/home/summary/route";
import {requireAuth} from "@/lib/auth/middleware";
import {reviewBankPayment} from "@/lib/payment/reviewBankPayment";
import {isStudentWorkspaceEnabled} from "@/lib/student/access";
import {PATCH as editAgent} from "@/app/api/voice-agent/agents/[id]/route";
vi.mock("@/lib/i18n/server",()=>({getServerLang:async()=>"fa"}));
describe.runIf(process.env.RUN_VOICE_INTEGRATION==="1")("registration and voice route access",()=>{
 const stamp=Date.now();const ids:string[]=[];let adminId:string,studentId:string;
 const request=(path:string,body?:unknown,userId?:string)=>new NextRequest(`http://localhost${path}`,{method:body?"POST":"GET",headers:{"content-type":"application/json",...(userId?{cookie:`token=${signToken({userId,role:"USER",plan:"FREE"})}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 beforeAll(async()=>{if(process.env.DATABASE_URL!=="file:./vitest.db")throw new Error("Isolated DB required");adminId=(await prisma.user.create({data:{email:`voice-admin-${stamp}@test.invalid`,role:"SUPER_ADMIN"}})).id;ids.push(adminId);});
 afterAll(async()=>{await prisma.user.deleteMany({where:{id:{in:ids}}});});
 it("persists student intent without paid access and normalizes email",async()=>{
  const r=await register(request("/api/auth/register",{name:"Student test",email:`  VOICE-STUDENT-${stamp}@TEST.INVALID  `,password:"Test-only-password",country:"IR",language:"fa",selectedPlan:"STUDENT_FIRST_THREE_MONTHS"}));
  expect(r.status).toBe(200);studentId=(await r.json()).user.id;ids.push(studentId);
  const u=await prisma.user.findUniqueOrThrow({where:{id:studentId}});expect(u.accountType).toBe("STUDENT");expect(u.plan).toBe("FREE");expect(u.email).toBe(`voice-student-${stamp}@test.invalid`);
 });
 it("persists Northern Cyprus business signup and Turkish language",async()=>{
  const r=await register(request("/api/auth/register",{name:"Business test",email:`voice-business-${stamp}@test.invalid`,password:"Test-only-password",country:"CY-NORTH",phone:"05339876543",language:"tr",selectedPlan:"TEAM_BUSINESS_GROW"}));
  expect(r.status).toBe(200);const id=(await r.json()).user.id;ids.push(id);const u=await prisma.user.findUniqueOrThrow({where:{id}});expect(u.accountType).toBe("BUSINESS");expect(u.phone).toBe("+905339876543");expect(u.language).toBe("tr");
 });
 it("restricts student management filtering to admins",async()=>{
  expect((await users(request("/api/admin/users?accountType=STUDENT",undefined,studentId))).status).toBe(403);
  const r=await users(request("/api/admin/users?accountType=STUDENT&page=1.5",undefined,adminId));expect(r.status).toBe(200);const d=await r.json();expect(d.users.every((u:{accountType:string})=>u.accountType==="STUDENT")).toBe(true);
 });
 it("rejects malformed voice setup and another user's agent edits",async()=>{
  expect((await createAgent(request("/api/voice-agent/agents",{name:"Invalid",openingHour:20,closingHour:10},studentId))).status).toBe(400);
  const a=await prisma.voiceAgent.create({data:{userId:adminId,name:"Owned agent",systemPrompt:"Test"}});
  expect((await editAgent(request(`/api/voice-agent/agents/${a.id}`,{name:"Stolen"},studentId),{params:Promise.resolve({id:a.id})})).status).toBe(404);
 });
 it("blocks expired chat before creating conversations or charging credits",async()=>{
  await prisma.user.update({where:{id:studentId},data:{plan:"PRO",planExpiry:new Date(Date.now()-1),credits:10000}});
  const before=await prisma.conversation.count({where:{userId:studentId}});
  const r=await chat(request("/api/chat",{message:"Test expired account"},studentId));expect(r.status).toBe(402);expect((await r.json()).code).toBe("SUBSCRIPTION_EXPIRED");
  expect(await prisma.conversation.count({where:{userId:studentId}})).toBe(before);expect((await prisma.user.findUniqueOrThrow({where:{id:studentId}})).credits).toBe(10000);
  for(const path of ["/api/student/ai","/api/image/generate","/api/voice-agent/agents","/api/crm/contacts"])expect(await requireAuth(request(path,undefined,studentId))).toBeNull();
  expect((await home(request("/api/home/summary",undefined,studentId))).status).toBe(402);
  expect((await requireAuth(request("/api/payment/create",undefined,studentId)))?.subscriptionStatus).toBe("expired");
 });
 it("blocks a free team member when the owner's subscription expired",async()=>{
  const owner=(await prisma.user.create({data:{email:`expired-owner-${stamp}@test.invalid`,plan:"TEAM",planExpiry:new Date(0)}})).id;ids.push(owner);
  const member=(await prisma.user.create({data:{email:`expired-member-${stamp}@test.invalid`,plan:"FREE"}})).id;ids.push(member);
  const team=await prisma.team.create({data:{ownerId:owner,name:"Expired test team",planExpiry:new Date(Date.now()+86400000),credits:10000,members:{create:{userId:member,role:"MEMBER"}}}});
  expect(await requireAuth(request("/api/chat",undefined,member))).toBeNull();
  await prisma.team.delete({where:{id:team.id}});
 });
 it("rejects student checkout for a business account",async()=>{
  const r=await buyPackage(request("/api/payment/create",{plan:"STUDENT_FIRST_THREE_MONTHS"},ids[2]));expect(r.status).toBe(403);expect((await r.json()).code).toBe("STUDENT_ACCOUNT_REQUIRED");
 });
 it("activates the paid Student Agent in University / School and on Home",async()=>{
  const p=await prisma.payment.create({data:{userId:studentId,plan:"STUDENT_FIRST_THREE_MONTHS",amount:8000,status:"PENDING",gateway:"bank_transfer",receiptAt:new Date(),receiptData:Buffer.from("test-only"),entitlementSnapshot:JSON.stringify({credits:100,days:90})}});
  await reviewBankPayment(p.id,adminId,true,"Test approval");
  const u=await prisma.user.findUniqueOrThrow({where:{id:studentId},include:{industryPack:true}});expect(u.accountType).toBe("STUDENT");expect(u.industryPack?.slug).toBe("university");expect(await isStudentWorkspaceEnabled(u)).toBe(true);
  const r=await home(request("/api/home/summary",undefined,studentId));expect(r.status).toBe(200);const d=await r.json();expect(d.agentAccess.student).toBe(true);expect(d.agentAccess.business).toBe(false);expect(d.industryPack.slug).toBe("university");
 });

});
