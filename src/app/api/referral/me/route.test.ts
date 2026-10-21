import {describe,it,expect,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),invited:vi.fn(),aggregate:vi.fn(),group:vi.fn(),update:vi.fn()}));
vi.mock('@/lib/auth/middleware',()=>({requireAuth:m.auth,unauthorizedResponse:()=>new Response(null,{status:401})}));
vi.mock('@/lib/db/prisma',()=>({prisma:{user:{findUnique:m.user,findMany:m.invited,updateMany:m.update},walletTransaction:{aggregate:m.aggregate,groupBy:m.group}}}));
vi.mock('@/lib/utils/referralWallet',()=>({getReferralCommissionPercent:async()=>15}));
vi.mock('@/lib/utils/changeReferralCode',()=>({changeReferralCode:vi.fn()}));
vi.mock('@/lib/utils/rateLimit',()=>({rateLimit:()=>({allowed:true})}));
import {GET} from './route';
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({id:'owner'});m.user.mockResolvedValue({referralCode:'cfa',walletBalance:150});m.invited.mockResolvedValue([{id:'friend',name:'Friend',payments:[{id:'p1'},{id:'p2'}],createdAt:new Date(),referralRewarded:true}]);m.aggregate.mockResolvedValue({_sum:{amount:150}});m.group.mockResolvedValue([{relatedUserId:'friend',_sum:{amount:150}}]);});
describe('fitness invitation reporting',()=>{
 it('uses confirmed purchases and recorded commission for each invited user',async()=>{const r=await GET(new NextRequest('http://localhost/api/referral/me'));const d=await r.json();expect(d.invitedUsers[0].successfulPurchases).toBe(2);expect(d.invitedUsers[0].commissionEarned).toBe(150);expect(m.invited.mock.calls[0][0].where.referredBy).toBe('owner');expect(m.invited.mock.calls[0][0].select.payments.where.status).toBe('SUCCESS');});
 it('does not report earned commission without ledger entries',async()=>{m.group.mockResolvedValue([]);const d=await(await GET(new NextRequest('http://localhost/api/referral/me'))).json();expect(d.invitedUsers[0].commissionEarned).toBe(0);});
 it('requires authentication',async()=>{m.auth.mockResolvedValue(null);expect((await GET(new NextRequest('http://localhost/api/referral/me'))).status).toBe(401);expect(m.invited).not.toHaveBeenCalled();});
});
