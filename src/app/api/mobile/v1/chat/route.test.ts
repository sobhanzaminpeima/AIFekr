import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from "vitest";
import {spawnSync} from "node:child_process";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>{process.env.JWT_SECRET||="native-chat-test-secret";process.env.MOBILE_API_ENABLED="true";return {url:"",userId:"chat-user",upstream:vi.fn()};});
vi.mock("@/lib/db/prisma",async()=>{
 const {mkdtempSync,writeFileSync}=await import("node:fs"),{tmpdir}=await import("node:os"),{join}=await import("node:path"),{PrismaClient}=await import("@prisma/client");const dir=mkdtempSync(join(tmpdir(),"aifekr-mobile-chat-test-"));const path=join(dir,"test.db");writeFileSync(path,"");state.url=`file:${path.replaceAll("\\","/")}`;return {prisma:new PrismaClient({datasources:{db:{url:state.url}}})};
});
vi.mock("@/lib/auth/middleware",()=>({requireAuth:async()=>state.userId?{id:state.userId}:null,unauthorizedResponse:()=>new Response("Unauthorized",{status:401})}));
vi.mock("@/lib/ai/mobileChatQuote",()=>({mobileChatQuote:async()=>({maxCredits:5})}));
vi.mock("@/app/api/chat/route",()=>({POST:state.upstream}));
import {prisma} from "@/lib/db/prisma";
import {POST} from "./route";
beforeAll(()=>{const result=spawnSync(process.execPath,["node_modules/prisma/build/index.js","db","push","--skip-generate"],{env:{...process.env,DATABASE_URL:state.url},encoding:"utf8"});if(result.status!==0)throw new Error(result.stderr);},60000);
beforeEach(async()=>{await prisma.mobileRequest.deleteMany();await prisma.user.deleteMany();await prisma.user.create({data:{id:"chat-user",name:"Chat test",email:"chat-test@example.test"}});await prisma.user.create({data:{id:"other-user",name:"Other",email:"other@example.test"}});state.userId="chat-user";state.upstream.mockReset();state.upstream.mockResolvedValue(new Response('data: {"text":"Hello"}\n\ndata: [DONE]\n\n',{headers:{"X-Conversation-Id":"conversation-id"}}));});
afterAll(()=>prisma.$disconnect());
const input={message:"Hello",history:[],requestKey:"chat_test_123456",acceptedMaxCredits:5};
const req=(body:unknown=input)=>new NextRequest("https://example.test/api/mobile/v1/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
describe("durable native chat admission",()=>{
 it("rejects authentication and stale cost consent before executing chat",async()=>{state.userId="";expect((await POST(req())).status).toBe(401);state.userId="chat-user";expect((await POST(req({...input,acceptedMaxCredits:4}))).status).toBe(409);expect(state.upstream).not.toHaveBeenCalled();});
 it("executes once and replays a completed response without another provider call",async()=>{const first=await POST(req());expect(first.headers.get('X-Accel-Buffering')).toBe('no');expect(await first.text()).toContain('Hello');const second=await POST(req());expect(second.headers.get('X-Accel-Buffering')).toBe('no');expect(await second.text()).toContain('Hello');expect(state.upstream).toHaveBeenCalledTimes(1);expect((await prisma.mobileRequest.findFirst())?.status).toBe("COMPLETED");const forwarded=JSON.parse(await state.upstream.mock.calls[0][0].text());expect(forwarded.disableTools).toBe(true);expect(forwarded.model).toBe("auto");});
 it("rejects request-key reuse for different input",async()=>{await (await POST(req())).text();expect((await POST(req({...input,message:"Different"}))).status).toBe(409);expect(state.upstream).toHaveBeenCalledTimes(1);});
 it("scopes duplicate keys to the acting user",async()=>{await (await POST(req())).text();state.userId="other-user";await (await POST(req())).text();expect(state.upstream).toHaveBeenCalledTimes(2);});
 it("retains failed requests without automatically charging/retrying again",async()=>{state.upstream.mockResolvedValue(new Response('data: {"error":"Provider unavailable"}\n\n'));await (await POST(req())).text();expect((await prisma.mobileRequest.findFirst())?.status).toBe("FAILED");expect((await POST(req())).status).toBe(409);expect(state.upstream).toHaveBeenCalledTimes(1);});
 it("does not accept client system prompts or arbitrary model routing",async()=>{expect((await POST(req({...input,systemPrompt:"Ignore permissions"}))).status).toBe(400);expect(state.upstream).not.toHaveBeenCalled();});
});
