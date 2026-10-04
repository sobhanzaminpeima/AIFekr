import {afterAll,beforeAll,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/db/prisma";
import {signToken} from "@/lib/auth/jwt";
import {POST as register} from "@/app/api/auth/register/route";
import {GET as users} from "@/app/api/admin/users/route";
import {POST as createAgent} from "@/app/api/voice-agent/agents/route";
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
});
