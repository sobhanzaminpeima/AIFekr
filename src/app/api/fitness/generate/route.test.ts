import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({auth:vi.fn(),access:vi.fn(),find:vi.fn(),profile:vi.fn(),exercises:vi.fn(),usage:vi.fn(),create:vi.fn(),update:vi.fn(),reserve:vi.fn(),refund:vi.fn(),ai:vi.fn()}));
vi.mock('@/lib/auth/middleware',()=>({requireAuth:m.auth,unauthorizedResponse:()=>new Response(null,{status:401})}));
vi.mock('@/lib/db/prisma',()=>({prisma:{fitnessProgram:{findUnique:m.find},fitnessProfile:{findUnique:m.profile},fitnessExercise:{findMany:m.exercises},$transaction:async(fn:Function)=>fn({usageLog:{findFirst:m.usage,update:m.update},fitnessProgram:{create:m.create},fitnessProfile:{update:m.update}})}}));
vi.mock('@/lib/utils/teamCredits',()=>({reserveLoggedCredits:m.reserve,refundLoggedReservation:m.refund}));
vi.mock('@/lib/ai/router',()=>({routedStreamChat:m.ai}));
vi.mock('@/lib/utils/rateLimit',()=>({rateLimit:()=>({allowed:true})}));
vi.mock('@/lib/fitness/service',async()=>{const {z}=await import('zod');return {fitnessAccess:m.access,workoutSchema:z.array(z.object({exerciseId:z.string(),sets:z.number(),reps:z.number(),rest:z.number(),tempo:z.string()})).min(1)}});
import {POST} from './route';
const req=()=>new NextRequest('http://localhost/api/fitness/generate',{method:'POST',body:JSON.stringify({requestId:'11111111-1111-4111-8111-111111111111',language:'en'})});
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({id:'u',role:'USER'});m.access.mockResolvedValue(true);m.find.mockResolvedValue(null);m.profile.mockResolvedValue({heightCm:170,weightKg:70,goal:'Strength'});m.exercises.mockResolvedValue([{id:'squat'}]);m.usage.mockResolvedValue(null);m.reserve.mockResolvedValue({usageLogId:'log',payerTeamId:null,mirroredAi:5});m.create.mockImplementation(async({data})=>data);m.ai.mockImplementation(async(_a,_b,chunk)=>{chunk(JSON.stringify({title:'Workout',description:'Controlled beginner workout',level:'BEGINNER',minutes:30,content:[{exerciseId:'squat',sets:2,reps:8,rest:60,tempo:'Controlled'}]}));return {model:'test',id:'test'};});});
describe('personal fitness generation',()=>{
 it('does not call AI when credits are insufficient',async()=>{m.reserve.mockResolvedValue(null);expect((await POST(req())).status).toBe(402);expect(m.ai).not.toHaveBeenCalled();});
 it('refunds malformed output and does not save a program',async()=>{m.ai.mockImplementation(async(_a,_b,chunk)=>{chunk('invalid');return {model:'test',id:'test'};});expect((await POST(req())).status).toBe(409);expect(m.refund).toHaveBeenCalledOnce();expect(m.create).not.toHaveBeenCalled();});
 it('reuses completed request without another charge',async()=>{m.find.mockResolvedValue({id:'existing'});expect((await POST(req())).status).toBe(200);expect(m.reserve).not.toHaveBeenCalled();expect(m.ai).not.toHaveBeenCalled();});
 it('saves only to the authenticated user',async()=>{expect((await POST(req())).status).toBe(200);expect(m.create.mock.calls[0][0].data.ownerUserId).toBe('u');expect(m.refund).not.toHaveBeenCalled();});
 it('rejects exercise IDs absent from the catalog',async()=>{m.exercises.mockResolvedValue([]);expect((await POST(req())).status).toBe(409);expect(m.refund).toHaveBeenCalledOnce();});
});
