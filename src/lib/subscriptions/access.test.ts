import {describe,it,expect} from "vitest";
import {featureAccessExpired,isRecoveryApi} from "./access";
const now=1000000;
describe("immediate subscription expiry",()=>{
 it("expires at the exact boundary without a grace period",()=>{expect(featureAccessExpired({plan:"PRO",planExpiry:new Date(now)},null,now)).toBe(true);expect(featureAccessExpired({plan:"PRO",planExpiry:new Date(now+1)},null,now)).toBe(false)});
 it("remaining credits and a changed FREE plan cannot evade expiry",()=>{expect(featureAccessExpired({plan:"FREE",planExpiry:new Date(now-1)},null,now)).toBe(true)});
 it("checks expired trials but permits a renewed paid plan",()=>{expect(featureAccessExpired({plan:"FREE",trialEndsAt:new Date(now-1)},null,now)).toBe(true);expect(featureAccessExpired({plan:"PRO",trialEndsAt:new Date(now-1),planExpiry:new Date(now+1)},null,now)).toBe(false)});
 it("permits an active limited trial",()=>{expect(featureAccessExpired({plan:"PRO",trialLimited:true,planExpiry:new Date(now+1)},null,now)).toBe(false)});
 it("uses the shared team subscription for free team members",()=>{expect(featureAccessExpired({plan:"FREE"},new Date(now-1),now)).toBe(true);expect(featureAccessExpired({plan:"FREE"},new Date(now+1),now)).toBe(false)});
 it("permits a paid team member after their earlier trial expired",()=>{expect(featureAccessExpired({plan:"FREE",trialEndsAt:new Date(0)},new Date(now+1),now)).toBe(false)});
 it("does not let the owner's stale team expiry bypass their expiry",()=>{expect(featureAccessExpired({plan:"TEAM",planExpiry:new Date(now-1)},new Date(now+1),now)).toBe(true)});
 it("keeps renewal and account recovery available while feature APIs close",()=>{for(const p of ["/api/chat","/api/image/generate","/api/student/ai","/api/voice-agent/agents","/api/crm/contacts"])expect(isRecoveryApi(p)).toBe(false);for(const p of ["/api/payment/create","/api/auth/me","/api/user/profile","/api/user/payments","/api/admin/users"])expect(isRecoveryApi(p)).toBe(true)});
});
