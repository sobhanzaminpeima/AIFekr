import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({admin:true,entry:vi.fn(async(lang:string)=>[{code:'TEST',minor:lang==='fa'?199000:73,currency:lang==='fa'?'IRT':'USD'}])}));
vi.mock('@/lib/auth/middleware',()=>({requireAdmin:async()=>mocks.admin?{id:'test-admin'}:null,unauthorizedResponse:()=>new Response('{}',{status:401})}));
vi.mock('@/lib/db/prisma',()=>({prisma:{package:{findMany:async()=>[{planCode:'TEST'}]}}}));
vi.mock('@/lib/marketing/entryPlans',()=>({getEntryPlans:mocks.entry}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {GET} from './route';
beforeEach(()=>{mocks.admin=true;mocks.entry.mockClear();});
describe('admin landing price previews',()=>{
 it('uses the public resolver and prevents stale admin responses',async()=>{const response=await GET(new NextRequest('http://localhost/api/admin/packages'));const body=await response.json();expect(body.landingPreview.fa[0].minor).toBe(199000);expect(body.landingPreview.de).toEqual(body.landingPreview.en);expect(mocks.entry).toHaveBeenCalledTimes(3);expect(response.headers.get('cache-control')).toBe('private, no-store');});
 it('does not expose package administration to guests',async()=>{mocks.admin=false;expect((await GET(new NextRequest('http://localhost/api/admin/packages'))).status).toBe(401);expect(mocks.entry).not.toHaveBeenCalled();});
});
