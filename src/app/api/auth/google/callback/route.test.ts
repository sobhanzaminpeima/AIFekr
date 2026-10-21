import {beforeEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({find:vi.fn(),update:vi.fn(),create:vi.fn(),ref:vi.fn(),promo:vi.fn(),fetch:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{user:{findUnique:m.find,update:m.update}}}));
vi.mock("@/lib/repositories/userRepository",()=>({createUser:m.create,findUserByReferralCode:m.ref}));
vi.mock("@/lib/utils/referralCode",()=>({generateUniqueReferralCode:async()=>"newname"}));
vi.mock("@/lib/utils/referralPromo",()=>({resolvePromo:m.promo}));
vi.mock("@/lib/auth/jwt",()=>({signToken:()=>"test-token",signRefreshToken:()=>"test-refresh"}));
import {GET} from "./route";
function request(extra="",state="same"){
 const req=new NextRequest(`https://aifekr.com/api/auth/google/callback?code=code&state=${state}${extra}`);
 req.cookies.set("google_oauth_state","same");req.cookies.set("google_oauth_context",JSON.stringify({selectedPlan:"STUDENT_QUARTERLY",language:"tr",accountType:"STUDENT",ref:"sobhan",promoCode:"sobhan",period:"monthly"}));return req;
}
beforeEach(()=>{vi.clearAllMocks();process.env.APP_URL="https://aifekr.com";process.env.GOOGLE_CLIENT_ID="client";process.env.GOOGLE_CLIENT_SECRET="secret";vi.stubGlobal("fetch",m.fetch);m.fetch.mockResolvedValueOnce({ok:true,json:async()=>({access_token:"access"})}).mockResolvedValueOnce({ok:true,json:async()=>({sub:"google-id",email:"NEW@EXAMPLE.COM",email_verified:true,name:"New Name"})});m.find.mockResolvedValue(null);m.ref.mockResolvedValue({id:"referrer"});m.promo.mockResolvedValue({id:"referrer"});m.create.mockResolvedValue({id:"new",role:"USER",plan:"FREE",language:"tr"});});
describe("Google login and registration",()=>{
 it("rejects invalid state before exchanging any credentials",async()=>{const r=await GET(request("","bad"));expect(r.headers.get("location")).toContain("/login?error=");expect(m.fetch).not.toHaveBeenCalled();});
 it("creates a student with inviter and referral code, preserves language and selected plan",async()=>{
  const r=await GET(request());expect(m.create.mock.calls[0][0]).toMatchObject({email:"new@example.com",credits:200,referralCode:"newname",referredBy:"referrer",accountType:"STUDENT",language:"tr"});
  expect(r.headers.get("location")).toBe("https://aifekr.com/welcome?plan=STUDENT_QUARTERLY&period=monthly");
  expect(r.cookies.get("google_oauth_state")?.value).toBe("");
  expect(r.cookies.get("token")?.value).toBe("test-token");
  expect(m.fetch.mock.calls[0][1].body.get("redirect_uri")).toBe("https://aifekr.com/api/auth/google/callback");
 });
 it("rejects unverified Google email before linking or creating an account",async()=>{
  m.fetch.mockReset().mockResolvedValueOnce({ok:true,json:async()=>({access_token:"access"})}).mockResolvedValueOnce({ok:true,json:async()=>({sub:"id",email:"x@example.com",email_verified:false})});
  const r=await GET(request());expect(r.headers.get("location")).toContain("verified");expect(m.find).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();
 });
 it("does not link or sign in a blocked email account",async()=>{
  m.find.mockResolvedValueOnce(null).mockResolvedValueOnce({id:"blocked",isBlocked:true});
  const r=await GET(request());expect(r.headers.get("location")).toContain("blocked");expect(m.update).not.toHaveBeenCalled();expect(r.cookies.get("token")).toBeUndefined();
 });
 it("does not send a second signup or create another user on existing Google login",async()=>{
  m.find.mockResolvedValue({id:"existing",isBlocked:false,role:"USER",plan:"FREE",language:"en"});
  const r=await GET(request());expect(m.create).not.toHaveBeenCalled();expect(r.cookies.get("token")).toBeDefined();
 });
 it("handles consent cancellation and clears short-lived cookies",async()=>{const r=await GET(request("&error=access_denied"));expect(r.headers.get("location")).toContain("cancelled");expect(m.fetch).not.toHaveBeenCalled();expect(r.cookies.get("google_oauth_context")?.value).toBe("");});
});
