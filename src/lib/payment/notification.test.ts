import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {notifyReceipt} from "./bank";
const mocks=vi.hoisted(()=>({payment:vi.fn(),update:vi.fn(),admins:vi.fn(),send:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{payment:{findUnique:mocks.payment,update:mocks.update},siteSetting:{findMany:async()=>[{key:"admin_notification_email",value:"notify@test.invalid"}]},user:{findMany:mocks.admins}}}));
vi.mock("resend",()=>({Resend:class{emails={send:mocks.send}}}));
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("RESEND_API_KEY","test-only-key");vi.stubEnv("RESEND_FROM","receipt@test.invalid");vi.stubEnv("TELEGRAM_NOTIFICATIONS_ENABLED","false");mocks.payment.mockResolvedValue({receiptAt:new Date(),notificationSentAt:null,transferMinor:8000,transferCurrency:"EUR"});mocks.admins.mockResolvedValue([{email:"admin@test.invalid"},{email:"notify@test.invalid"}]);mocks.send.mockResolvedValue({data:{id:"test-message"},error:null});});
afterEach(()=>vi.unstubAllEnvs());
describe("receipt notification delivery",()=>{
 it("notifies configured and active admin recipients without duplicate addresses",async()=>{await notifyReceipt("receipt-1");const message=mocks.send.mock.calls[0][0];expect(message.to).toBe("notify@test.invalid");expect(message.bcc).toEqual(["admin@test.invalid"]);expect(mocks.update.mock.calls[0][0].data.notificationSentAt).toBeInstanceOf(Date);});
 it("keeps failed delivery in the durable retry queue",async()=>{mocks.send.mockResolvedValue({error:{message:"Provider unavailable"},data:null});await notifyReceipt("receipt-1");const data=mocks.update.mock.calls[0][0].data;expect(data.notificationError).toBe("Provider unavailable");expect(data.notificationSentAt).toBeUndefined();expect(data.notificationAttempts).toEqual({increment:1});});
 it("does not call a missing email provider or falsely mark success",async()=>{vi.stubEnv("RESEND_API_KEY","");await notifyReceipt("receipt-1");expect(mocks.send).not.toHaveBeenCalled();expect(mocks.update.mock.calls[0][0].data.notificationError).toBe("Email provider is not configured");});
 it("does not resend a notification already accepted by the provider",async()=>{mocks.payment.mockResolvedValue({receiptAt:new Date(),notificationSentAt:new Date()});await notifyReceipt("receipt-1");expect(mocks.send).not.toHaveBeenCalled();});
});
