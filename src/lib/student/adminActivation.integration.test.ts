import {afterAll,beforeAll,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {prisma} from "@/lib/db/prisma";
import {signToken} from "@/lib/auth/jwt";
import {PATCH as setModule} from "@/app/api/admin/users/[id]/module-overrides/route";
import {GET as listUsers,POST as createUser} from "@/app/api/admin/users/route";
import {GET as detail} from "@/app/api/admin/users/[id]/route";
import {POST as provision} from "@/app/api/voice-agent/agents/[id]/provision/route";
import {POST as activateInvite} from "@/app/api/admin/invites/activate-trial/route";
import {isStudentWorkspaceEnabled} from "./access";
vi.mock("@/lib/i18n/server",()=>({getServerLang:async()=>"fa"}));
describe.runIf(process.env.RUN_BANK_INTEGRATION==="1")("admin student activation and account history",()=>{
 const ids:string[]=[];const stamp=Date.now();let admin:string,buyer:string;
 const request=(path:string,id:string,body?:unknown)=>new NextRequest(`http://localhost${path}`,{method:body?"POST":"GET",headers:{cookie:`token=${signToken({userId:id,role:"USER",plan:"FREE"})}`,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 beforeAll(async()=>{
  if(process.env.DATABASE_URL!=="file:./vitest.db")throw new Error("Isolated DB required");
  await prisma.package.upsert({where:{planCode:"STUDENT_FIRST_THREE_MONTHS"},update:{},create:{planCode:"STUDENT_FIRST_THREE_MONTHS",name:"Student QA",nameEn:"Student QA",price:80000,priceUsd:8000,credits:1000,features:"[]",duration:90}});
  admin=(await prisma.user.create({data:{email:`activation-admin-${stamp}@test.invalid`,role:"SUPER_ADMIN"}})).id;
  buyer=(await prisma.user.create({data:{email:`activation-buyer-${stamp}@test.invalid`,accountType:"PERSONAL",plan:"FREE",planExpiry:new Date(0),credits:20}})).id;ids.push(admin,buyer);
 });
 afterAll(async()=>{await prisma.auditLog.deleteMany({where:{targetId:{in:ids}}});await prisma.user.deleteMany({where:{id:{in:ids}}});});
 it("blocks self-granted student activation",async()=>{expect((await setModule(request("/api/admin/users/x/module-overrides",buyer,{moduleKey:"student.workspace",enabled:true}),{params:{id:buyer}})).status).toBe(401);});
 it("activates an expired personal account and classifies it as a student",async()=>{
  const response=await setModule(request("/api/admin/users/x/module-overrides",admin,{moduleKey:"student.workspace",enabled:true}),{params:{id:buyer}});expect(response.status).toBe(200);
  const u=await prisma.user.findUniqueOrThrow({where:{id:buyer},include:{industryPack:true}});expect(u.accountType).toBe("STUDENT");expect(u.plan).toBe("STUDENT_FIRST_THREE_MONTHS");expect(u.industryPack?.slug).toBe("university");expect(await isStudentWorkspaceEnabled(u)).toBe(true);expect(u.planExpiry!.getTime()).toBeGreaterThan(Date.now()+89*86400000);
  const filtered=await listUsers(request(`/api/admin/users?accountType=STUDENT&search=activation-buyer-${stamp}`,admin));expect((await filtered.json()).users.map((u:{id:string})=>u.id)).toContain(buyer);
 });
 it("repeated activation does not double credits or extend the entitlement",async()=>{const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});await setModule(request("/api/admin/users/x/module-overrides",admin,{moduleKey:"student.workspace",enabled:true}),{params:{id:buyer}});const after=await prisma.user.findUniqueOrThrow({where:{id:buyer}});expect(after.credits).toBe(before.credits);expect(after.planExpiry).toEqual(before.planExpiry);});
 it("creates a student account with the full package from the admin form",async()=>{const response=await createUser(request("/api/admin/users",admin,{name:"Student created",email:`created-student-${stamp}@test.invalid`,password:"Test-password-only",studentPackage:true,accountType:"STUDENT"}));expect(response.status).toBe(201);const id=(await response.json()).user.id;ids.push(id);expect(await isStudentWorkspaceEnabled({id})).toBe(true);});
 it("returns account history without password hashes",async()=>{const response=await detail(request("/api/admin/users/x",admin),{params:{id:buyer}});const data=await response.json();expect(data.user.passwordHash).toBeUndefined();expect(data.history.some((e:{action:string})=>e.action==="student_activated")).toBe(true);expect(data.history.some((e:{action:string})=>e.action==="account_registered")).toBe(true);});
 it("keeps phone provider setup restricted to admins",async()=>{expect((await provision(request("/api/voice-agent/agents/x/provision",buyer,{}),{params:Promise.resolve({id:"x"})})).status).toBe(403);});
 it("supports student invites without replacing an already active student entitlement",async()=>{const before=await prisma.user.findUniqueOrThrow({where:{id:buyer}});const response=await activateInvite(request("/api/admin/invites/activate-trial",admin,{userId:buyer,studentPackage:true,trialDays:90}));expect(response.status).toBe(200);const after=await prisma.user.findUniqueOrThrow({where:{id:buyer}});expect(after.plan).toBe(before.plan);expect(after.credits).toBe(before.credits);expect(after.planExpiry).toEqual(before.planExpiry);expect(after.realEstatePackage).toBe(false);});

});
