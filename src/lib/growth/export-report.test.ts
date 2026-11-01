import {describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({role:'SUPER_ADMIN',audit:vi.fn(),customers:vi.fn(),overview:vi.fn(),campaigns:vi.fn()}));
vi.mock('@/lib/auth/middleware',()=>({requireAdmin:async()=>({id:'admin',role:mock.role}),forbiddenResponse:()=>new Response('{}',{status:403})}));
vi.mock('@/lib/db/prisma',()=>({prisma:{auditLog:{create:mock.audit}}}));
vi.mock('@/lib/growth/config',()=>({getGrowthSettings:async()=>({flags:{customer_growth_enabled:true}}),saveGrowthSettings:vi.fn()}));
vi.mock('@/lib/growth/analytics',()=>({customerList:mock.customers,overview:mock.overview,campaignReport:mock.campaigns,csvEscape:(v:unknown)=>JSON.stringify(v),customerDetail:vi.fn()}));
vi.mock('@/lib/growth/automation',()=>({RULES:[],TEMPLATE_VARIABLES:[],runLifecycle:vi.fn(),validateTemplate:vi.fn()}));
import {GET} from '@/app/api/admin/growth/route';
describe('complete growth report',()=>{
 it('rejects ordinary admins before reading customer data',async()=>{mock.role='ADMIN';mock.customers.mockClear();const r=await GET(new NextRequest('http://localhost/api/admin/growth?view=export-report'));expect(r.status).toBe(403);expect(mock.customers).not.toHaveBeenCalled();mock.role='SUPER_ADMIN'});
 it('exports one complete snapshot, funnel and campaigns with a date scope and audit',async()=>{mock.customers.mockResolvedValue({rows:[{id:'test-customer',score:75}]});mock.overview.mockResolvedValue({kpis:{signups:1}});mock.campaigns.mockResolvedValue([{key:'launch'}]);const r=await GET(new NextRequest('http://localhost/api/admin/growth?view=export-report&from=2026-10-01&to=2026-10-31'));expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');expect(r.headers.get('content-disposition')).toContain('.json');const report=await r.json();expect(report.customers).toHaveLength(1);expect(report.campaigns[0].key).toBe('launch');expect(mock.customers).toHaveBeenCalledWith(expect.objectContaining({page:1}),true);expect(mock.overview).toHaveBeenCalledWith(expect.objectContaining({from:new Date('2026-10-01T00:00:00Z')}),true);expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:'growth_complete_report_exported'})}));expect(report.definitions.snapshot).toContain('export time')});
 it('rejects backwards ranges',async()=>{const r=await GET(new NextRequest('http://localhost/api/admin/growth?view=export-report&from=2026-10-31&to=2026-10-01'));expect(r.status).toBe(400)});
});
