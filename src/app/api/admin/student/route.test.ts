import { NextRequest } from "next/server";
import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({admin:vi.fn(),setting:vi.fn(),count:vi.fn()}));
vi.mock("@/lib/auth/middleware",()=>({requireAdmin:mocks.admin,requireAuth:async()=>null,unauthorizedResponse:()=>new Response(null,{status:401}),forbiddenResponse:()=>new Response(null,{status:403})}));
vi.mock("@/lib/student/costs",()=>({getThesisAssistCreditCost:async()=>20,setThesisAssistCreditCost:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{siteSetting:{findUnique:mocks.setting},user:{count:mocks.count},studentCourse:{count:async()=>0,findMany:async()=>[]},studentMaterial:{count:async()=>0},studentNote:{count:async()=>0},studentFlashcard:{count:async()=>0},studentQuiz:{count:async()=>0},studentQuizAttempt:{count:async()=>0,aggregate:async()=>({_avg:{score:null,total:null}})},studentExam:{count:async()=>0},studentTask:{count:async()=>0},usageLog:{count:async()=>0,aggregate:async()=>({_sum:{credits:null}})}}}));
import { GET } from "./route";
beforeEach(()=>{vi.clearAllMocks();mocks.admin.mockResolvedValue({id:"admin"});mocks.setting.mockResolvedValue({value:"true"});mocks.count.mockResolvedValue(3);});
describe("student admin entitlement metrics",()=>{
 it("reads the global default independently of a signed-in student",async()=>{const data=await(await GET(new NextRequest("https://aifekr.test/api/admin/student"))).json();expect(data.enabled).toBe(true);expect(data.stats.activeUsers).toBe(3);expect(data.stats.courses).toBe(0);expect(mocks.count.mock.calls[0][0].where.planExpiry.gt).toBeInstanceOf(Date);});
 it("counts explicitly enabled students when default is disabled",async()=>{mocks.setting.mockResolvedValue({value:"false"});const data=await(await GET(new NextRequest("https://aifekr.test/api/admin/student"))).json();expect(data.enabled).toBe(false);expect(mocks.count.mock.calls[0][0].where.OR).toEqual([{moduleOverrides:{some:{moduleKey:"student.workspace",enabled:true}}}]);});
 it("requires an administrator",async()=>{mocks.admin.mockResolvedValue(null);expect((await GET(new NextRequest("https://aifekr.test/api/admin/student"))).status).toBe(401);expect(mocks.count).not.toHaveBeenCalled();});
});
