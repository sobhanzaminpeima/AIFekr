import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),update:vi.fn(),pack:vi.fn(),enabled:vi.fn()}));
vi.mock("@/lib/auth/middleware",()=>({requireAuth:mocks.auth,unauthorizedResponse:()=>new Response(null,{status:401})}));
vi.mock("@/lib/db/prisma",()=>({prisma:{user:{update:mocks.update},package:{findUnique:mocks.pack}}}));
vi.mock("@/lib/student/access",()=>({isStudentWorkspaceEnabled:mocks.enabled}));
import { POST } from "./route";
const req=(body:unknown)=>new NextRequest("https://aifekr.test/api/user/onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({id:"student",accountType:"STUDENT"});mocks.pack.mockResolvedValue({isActive:true});mocks.enabled.mockResolvedValue(false);});
describe("onboarding preserves purchase intent",()=>{
 it("keeps a selected student package and its fixed period",async()=>{const data=await(await POST(req({businessType:"student",selectedPlan:"STUDENT_QUARTERLY",period:"semiannual"}))).json();expect(data.redirect).toBe("/plans?plan=STUDENT_QUARTERLY&period=monthly");});
 it("takes unpaid students to checkout even when introduction is skipped",async()=>{const data=await(await POST(req({}))).json();expect(data.redirect).toContain("STUDENT_QUARTERLY");});
 it("takes an already active student straight to their workspace",async()=>{mocks.enabled.mockResolvedValue(true);const data=await(await POST(req({businessType:"student"}))).json();expect(data.redirect).toBe("/student");});
 it("keeps business purchase period",async()=>{mocks.auth.mockResolvedValue({id:"b",accountType:"BUSINESS"});const data=await(await POST(req({selectedPlan:"TEAM_BUSINESS_GROW",period:"quarterly"}))).json();expect(data.redirect).toBe("/plans?plan=TEAM_BUSINESS_GROW&period=quarterly");});
 it("does not redirect to arbitrary external URLs",async()=>{mocks.auth.mockResolvedValue({id:"b",accountType:"BUSINESS"});mocks.pack.mockResolvedValue(null);expect((await(await POST(req({selectedPlan:"//evil.test"}))).json()).redirect).toBe("/chat");});
 it.each([null,[]])("rejects malformed request objects",async(body)=>{expect((await POST(req(body))).status).toBe(400);expect(mocks.update).not.toHaveBeenCalled();});
});
