import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deliverNotificationEmails } from "./deliverEmail";
const mock = vi.hoisted(() => ({ findMany:vi.fn(),updateMany:vi.fn(),findUnique:vi.fn(),send:vi.fn() }));
vi.mock("@/lib/db/prisma",()=>({prisma:{notification:{findMany:mock.findMany,updateMany:mock.updateMany},user:{findUnique:mock.findUnique}}}));
vi.mock("resend",()=>({Resend:class {emails={send:mock.send}}}));
beforeEach(()=>{
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY","fixture");
  vi.stubEnv("RESEND_FROM","fixture@example.test");
  vi.stubEnv("APP_URL","https://example.test");
  mock.findMany.mockResolvedValue([{id:"event-1",userId:"buyer",title:"Approved",body:"<text>",link:"/settings?tab=economy"}]);
  mock.updateMany.mockResolvedValue({count:1});
  mock.findUnique.mockResolvedValue({email:"buyer@example.test",language:"en",isBlocked:false});
});
afterEach(()=>vi.unstubAllEnvs());
it("records accepted email with a stable provider key and an escaped profile link",async()=>{
  mock.send.mockResolvedValue({data:{id:"receipt"}});
  await deliverNotificationEmails("economy");
  expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({to:"buyer@example.test",html:expect.stringContaining("https://example.test/settings?tab=economy")}),{idempotencyKey:"economy-notification-event-1"});
  expect(mock.send.mock.calls[0][0].html).toContain("&lt;text&gt;");
  expect(mock.updateMany.mock.calls.at(-1)?.[0].data.emailPending).toBe(false);
});
it("retains failed jobs for retry and avoids sending a job leased elsewhere",async()=>{
  mock.send.mockResolvedValue({error:{message:"unavailable"}});
  await deliverNotificationEmails("economy");
  expect(mock.updateMany.mock.calls.at(-1)?.[0].data).toEqual({emailError:expect.any(String)});
  mock.updateMany.mockResolvedValue({count:0});
  await deliverNotificationEmails("economy");
  expect(mock.send).toHaveBeenCalledTimes(1);
});
it("keeps pending emails intact when delivery is unconfigured",async()=>{
  vi.stubEnv("RESEND_API_KEY","");
  await deliverNotificationEmails("economy");
  expect(mock.updateMany).not.toHaveBeenCalled();
});
