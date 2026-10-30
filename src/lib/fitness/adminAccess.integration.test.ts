import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {prisma} from "@/lib/db/prisma";
import {fitnessAccess} from "./service";
import {getAvailableCredits} from "@/lib/utils/teamCredits";
import {NextRequest} from "next/server";
const auth=vi.hoisted(()=>({id:"qa-admin",role:"ADMIN"}));vi.mock("@/lib/auth/middleware",()=>({requireAdmin:async()=>auth.role==="ADMIN"?auth:null,unauthorizedResponse:()=>new Response(null,{status:401})}));
import {PUT} from "@/app/api/admin/users/[id]/fitness/route";
const id="fitness-grant-"+Date.now();
beforeAll(async()=>{await prisma.user.create({data:{id,accountType:"STUDENT",plan:"FREE",credits:50,planExpiry:new Date(0)}});});afterAll(async()=>{await prisma.auditLog.deleteMany({where:{targetId:id}});await prisma.user.delete({where:{id}});});
// The route accepts only same-origin admin requests (CSRF guard), so the test sends the site's own Origin.
function request(enabled:boolean,origin:string|null="http://localhost"){return new NextRequest("http://localhost/api/admin/users/"+id+"/fitness",{method:"PUT",headers:{"Content-Type":"application/json",...(origin?{origin}:{})},body:JSON.stringify({enabled,days:30,reason:"Authorized QA access grant"})});}
it("admin activation preserves account type and does not fabricate health consent",async()=>{expect((await PUT(request(true),{params:Promise.resolve({id})})).status).toBe(200);expect(await fitnessAccess(id,"USER")).toBe(true);expect(await getAvailableCredits(id,prisma,"PERSONAL")).toBe(50);expect((await prisma.user.findUniqueOrThrow({where:{id}})).accountType).toBe("STUDENT");expect(await prisma.fitnessProfile.findUnique({where:{userId:id}})).toBeNull();expect(await prisma.auditLog.count({where:{targetId:id,action:"fitness_admin_access_changed"}})).toBe(1);});
it("revocation closes independent access and students cannot grant it",async()=>{expect((await PUT(request(false),{params:Promise.resolve({id})})).status).toBe(200);expect(await fitnessAccess(id,"USER")).toBe(false);auth.role="USER";expect((await PUT(request(true),{params:Promise.resolve({id})})).status).toBe(401);});
it("rejects an admin request from another origin or without one",async()=>{auth.role="ADMIN";expect((await PUT(request(true,"https://evil.example"),{params:Promise.resolve({id})})).status).toBe(403);expect((await PUT(request(true,null),{params:Promise.resolve({id})})).status).toBe(403);});
