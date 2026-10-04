import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({account:vi.fn(),setting:vi.fn(),override:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{user:{findUnique:mocks.account},siteSetting:{findUnique:mocks.setting},userModuleOverride:{findUnique:mocks.override}}}));
import {isStudentWorkspaceEnabled,studentWorkspaceDisabledResponse} from "./access";
beforeEach(()=>{vi.clearAllMocks();mocks.account.mockResolvedValue({accountType:"STUDENT",plan:"STUDENT_FIRST_THREE_MONTHS",planExpiry:new Date(Date.now()+86400000),isBlocked:false});mocks.setting.mockResolvedValue({value:"true"});mocks.override.mockResolvedValue(null);});
describe("paid student agent access",()=>{
 it("allows a paid student account",async()=>{expect(await isStudentWorkspaceEnabled({id:"student"})).toBe(true)});
 it("denies business accounts even with an explicit enable override",async()=>{mocks.account.mockResolvedValue({accountType:"BUSINESS",plan:"STUDENT_MONTHLY",planExpiry:new Date(Date.now()+86400000)});mocks.override.mockResolvedValue({enabled:true});expect(await isStudentWorkspaceEnabled({id:"business"})).toBe(false)});
 it("denies expired subscriptions despite credits or an enable override",async()=>{mocks.account.mockResolvedValue({accountType:"STUDENT",plan:"STUDENT_MONTHLY",planExpiry:new Date(0)});mocks.override.mockResolvedValue({enabled:true});expect(await isStudentWorkspaceEnabled({id:"expired"})).toBe(false)});
 it("denies student intent without a paid student package",async()=>{mocks.account.mockResolvedValue({accountType:"STUDENT",plan:"FREE",planExpiry:null});expect(await isStudentWorkspaceEnabled({id:"unpaid"})).toBe(false)});
 it("honors an administrator disable",async()=>{mocks.override.mockResolvedValue({enabled:false});expect(await isStudentWorkspaceEnabled({id:"student"})).toBe(false);expect((await studentWorkspaceDisabledResponse({id:"student"}))?.status).toBe(403)});
 it("requires an account and can be disabled globally",async()=>{expect(await isStudentWorkspaceEnabled()).toBe(false);mocks.setting.mockResolvedValue({value:"false"});expect(await isStudentWorkspaceEnabled({id:"student"})).toBe(false)});
});
