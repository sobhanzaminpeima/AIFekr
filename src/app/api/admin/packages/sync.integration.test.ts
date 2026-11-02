import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const actor=vi.hoisted(()=>({id:'pricing-sync-admin-test',role:'SUPER_ADMIN'}));
vi.mock('@/lib/auth/middleware',()=>({requireAdmin:async()=>actor,unauthorizedResponse:()=>new Response('{}',{status:401})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/billing/rates',()=>({currencyConvert:async()=>{throw Error('NO_TEST_RATE');}}));
import {prisma} from '@/lib/db/prisma';
import {getEntryPlans} from '@/lib/marketing/entryPlans';
import {POST,PUT,PATCH,GET} from './route';
const code=`TEST_PRICE_SYNC_${Date.now()}`;
beforeAll(async()=>{await prisma.user.upsert({where:{id:actor.id},create:{id:actor.id,role:'SUPER_ADMIN'},update:{}});});
afterAll(async()=>{await prisma.package.deleteMany({where:{planCode:code}});await prisma.auditLog.deleteMany({where:{actorId:actor.id}});await prisma.user.deleteMany({where:{id:actor.id}});});
function request(method:string,body:unknown){return new NextRequest('http://localhost/api/admin/packages',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
it('reflects admin price, category and visibility changes in the real landing resolver',async()=>{
 const input={planCode:code,name:'آزمایش محلی',nameEn:'Local test',category:'BUSINESS',baseCurrency:'IRT',termPrices:{monthly:199000},credits:100,duration:30,publicationStatus:'PUBLISHED',publicVisible:true,isActive:true,entitlements:{fixedPrices:{USD:{monthly:73},TRY:{monthly:3660}}}};
 const created=await POST(request('POST',input));expect(created.status).toBe(200);const id=(await created.json()).package.id;
 expect((await getEntryPlans('fa')).find(p=>p.code===code)?.minor).toBe(199000);
 const updated=await PUT(request('PUT',{...input,id,category:'FITNESS',termPrices:{monthly:299000}}));expect(updated.status).toBe(200);
 const landing=(await getEntryPlans('fa')).find(p=>p.code===code)!;expect(landing).toMatchObject({minor:299000,category:'FITNESS'});
 const admin=await GET(new NextRequest('http://localhost/api/admin/packages'));expect((await admin.json()).landingPreview.fa.find((p:{code:string})=>p.code===code)).toEqual(landing);
 expect((await PATCH(request('PATCH',{id,isActive:false}))).status).toBe(200);
 expect((await getEntryPlans('fa')).find(p=>p.code===code)).toBeUndefined();
});
