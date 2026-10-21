import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({find:vi.fn(),claim:vi.fn(),update:vi.fn(),send:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{user:{findMany:m.find,updateMany:m.claim,update:m.update}}}));
vi.mock("resend",()=>({Resend:class{emails={send:m.send}}}));
import {deliverSignupNotifications} from "./signupNotifications";
beforeEach(()=>{vi.clearAllMocks();process.env.RESEND_API_KEY="test";process.env.RESEND_FROM="noreply@aifekr.com";delete process.env.SIGNUP_NOTIFICATION_TO;m.find.mockResolvedValue([{id:"user",name:"<script>",email:"test@example.com",phone:null,accountType:"STUDENT",authProvider:"google",createdAt:new Date("2026-10-09")}]);m.claim.mockResolvedValue({count:1});m.send.mockResolvedValue({data:{id:"email"},error:null});});
describe("durable new-user alerts",()=>{
 it("sends only to the requested support address, escapes user data and marks accepted mail",async()=>{
  expect(await deliverSignupNotifications()).toMatchObject({sent:1});
  expect(m.send.mock.calls[0][0]).toMatchObject({to:"support@aifekr.com"});
  expect(m.send.mock.calls[0][0].html).toContain("&lt;script&gt;");
  expect(m.send.mock.calls[0][1]).toEqual({idempotencyKey:"aifekr-signup-user"});
  expect(m.update.mock.calls[0][0].data.signupNotifiedAt).toBeInstanceOf(Date);
 });
 it("never records false success when provider rejects delivery",async()=>{
  m.send.mockResolvedValue({error:{message:"bad"}});expect(await deliverSignupNotifications()).toMatchObject({sent:0,pending:true});
  expect(m.update.mock.calls[0][0].data.signupNotifiedAt).toBeUndefined();
  expect(m.update.mock.calls[0][0].data.signupNotificationError).toContain("pending");
 });
 it("does not send if another worker owns the claim",async()=>{m.claim.mockResolvedValue({count:0});await deliverSignupNotifications();expect(m.send).not.toHaveBeenCalled();});
 it("reports missing provider setup without falsely marking historical users",async()=>{delete process.env.RESEND_API_KEY;expect(await deliverSignupNotifications()).toMatchObject({configured:false,sent:0});expect(m.find).not.toHaveBeenCalled();});
});
