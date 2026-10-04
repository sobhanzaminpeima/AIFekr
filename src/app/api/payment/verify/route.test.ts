import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({find:vi.fn(),verify:vi.fn(),settle:vi.fn(),failed:vi.fn()}));
vi.mock("@/lib/repositories/paymentRepository",()=>({findPaymentById:mocks.find,markPaymentFailed:mocks.failed,activatePlanForPayment:vi.fn()}));
vi.mock("@/lib/payment/zarinpal",()=>({verifyPayment:mocks.verify}));
vi.mock("@/lib/payment/reviewBankPayment",()=>({settleVerifiedPayment:mocks.settle}));
vi.mock("@/lib/db/prisma",()=>({prisma:{payment:{updateMany:mocks.failed}}}));
vi.mock("@/lib/email/resend",()=>({sendPaymentConfirmEmail:vi.fn()}));
import {GET} from "./route";
const callback=()=>new NextRequest("http://localhost/api/payment/verify?paymentId=p1&Authority=A1&Status=OK");
beforeEach(()=>{vi.clearAllMocks();mocks.find.mockResolvedValue({id:"p1",userId:"u1",gateway:"zarinpal",authority:"A1",status:"PENDING",amount:8000,plan:"STUDENT_FIRST_THREE_MONTHS",entitlementSnapshot:JSON.stringify({credits:1000,days:90}),user:{email:null}});mocks.verify.mockResolvedValue({ok:true,refId:"123"});mocks.settle.mockResolvedValue(true);});
describe("Zarinpal callback",()=>{
 it("verifies the stored amount before activation",async()=>{const response=await GET(callback());expect(mocks.verify).toHaveBeenCalledWith({authority:"A1",amount:8000});expect(mocks.settle).toHaveBeenCalledWith("p1","A1","123");expect(response.headers.get("location")).toContain("payment=success");});
 it("rejects authorities belonging to another purchase",async()=>{mocks.find.mockResolvedValue({gateway:"zarinpal",authority:"A2",status:"PENDING",plan:"PRO"});expect((await GET(callback())).headers.get("location")).toContain("payment=failed");expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled();});
 it("does not activate failed verification",async()=>{mocks.verify.mockResolvedValue({ok:false});expect((await GET(callback())).headers.get("location")).toContain("payment=failed");expect(mocks.failed).toHaveBeenCalledWith({where:{id:"p1",status:"PENDING",authority:"A1"},data:{status:"FAILED"}});expect(mocks.settle).not.toHaveBeenCalled();});
 it("does not repeat verification or activation for a completed callback",async()=>{mocks.find.mockResolvedValue({gateway:"zarinpal",authority:"A1",status:"SUCCESS",plan:"PRO"});expect((await GET(callback())).headers.get("location")).toContain("payment=success");expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled();});
 it("cannot activate a bank receipt through a gateway callback",async()=>{mocks.find.mockResolvedValue({gateway:"bank_transfer",authority:"A1",status:"PENDING",plan:"PRO"});await GET(callback());expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled();});
});
