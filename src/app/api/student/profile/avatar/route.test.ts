import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import sharp from "sharp";
const mocks=vi.hoisted(()=>({user:vi.fn(),publicUser:vi.fn(),auth:vi.fn(),update:vi.fn(),fetch:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{user:{findUnique:mocks.user,findFirst:mocks.publicUser,update:mocks.update}}}));
vi.mock("@/lib/auth/middleware",()=>({requireAuth:mocks.auth,unauthorizedResponse:()=>new Response(null,{status:401})}));
vi.mock("@/lib/student/access",()=>({studentWorkspaceDisabledResponse:async()=>null}));
import {GET,POST} from "./route";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("R2_PUBLIC_URL","https://storage.test.invalid");vi.stubGlobal("fetch",mocks.fetch);mocks.auth.mockResolvedValue({id:"photo-owner"});mocks.user.mockResolvedValue({id:"photo-owner",avatar:"https://storage.test.invalid/images/photo.webp"});mocks.publicUser.mockResolvedValue(null);});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("same-origin student photo",()=>{
 it("decodes the saved storage photo and returns canvas-safe image bytes",async()=>{const image=await sharp({create:{width:32,height:32,channels:3,background:"#6366f1"}}).png().toBuffer();mocks.fetch.mockResolvedValue(new Response(new Uint8Array(image),{headers:{"content-type":"image/png"}}));const response=await GET(new NextRequest("http://localhost/api/student/profile/avatar"));expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("image/webp");expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width).toBe(512);expect(mocks.fetch.mock.calls[0][1].redirect).toBe("error");});
 it("requires authentication for a private photo",async()=>{mocks.auth.mockResolvedValue(null);expect((await GET(new NextRequest("http://localhost/api/student/profile/avatar"))).status).toBe(401);expect(mocks.fetch).not.toHaveBeenCalled();});
 it("does not expose a nonpublic profile by slug",async()=>{expect((await GET(new NextRequest("http://localhost/api/student/profile/avatar?slug=private"))).status).toBe(404);expect(mocks.publicUser.mock.calls[0][0].where.studentProfilePublic).toBe(true);});
 it("never fetches arbitrary hosts or local addresses from a stored avatar",async()=>{mocks.user.mockResolvedValue({id:"photo-owner",avatar:"https://127.0.0.1/internal"});expect((await GET(new NextRequest("http://localhost/api/student/profile/avatar"))).status).toBe(400);expect(mocks.fetch).not.toHaveBeenCalled();});
 it("persists a real optimized photo without requiring external storage",async()=>{const bytes=await sharp({create:{width:32,height:32,channels:3,background:"#6366f1"}}).png().toBuffer();const form=new FormData();form.set("file",new File([new Uint8Array(bytes)],"test.png",{type:"image/png"}));mocks.update.mockImplementation(async({data})=>({avatar:data.avatar}));const response=await POST(new NextRequest("http://localhost/api/student/profile/avatar",{method:"POST",body:form}));expect(response.status).toBe(200);const photo=(await response.json()).avatar;expect(photo).toMatch(/^data:image\/webp;base64,/);expect((await sharp(Buffer.from(photo.split(",")[1],"base64")).metadata()).width).toBe(32);expect(mocks.fetch).not.toHaveBeenCalled();});
 it("serves a persisted profile photo directly without storage calls",async()=>{const bytes=await sharp({create:{width:32,height:32,channels:3,background:"#6366f1"}}).webp().toBuffer();mocks.user.mockResolvedValue({id:"photo-owner",avatar:`data:image/webp;base64,${bytes.toString("base64")}`});const response=await GET(new NextRequest("http://localhost/api/student/profile/avatar"));expect(response.status).toBe(200);expect(mocks.fetch).not.toHaveBeenCalled();expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);});

});
