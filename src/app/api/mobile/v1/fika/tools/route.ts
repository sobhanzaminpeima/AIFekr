import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {buildWorkspaceContext,contextHasCrmAccess} from '@/lib/orchestrator/isolation';
import {crmRecentContacts,crmFollowUpsDue} from '@/lib/orchestrator/tools/crm';
import {resolveOrganizationContext,hasOrganizationPermission} from '@/lib/organization/context';
import {getServerLang} from '@/lib/i18n/server';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 if(process.env.MOBILE_API_ENABLED!=='true')return reply({error:'Mobile API disabled'},503);
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`mobile-fika-tools:${user.id}`,30,60000).allowed)return reply({error:'Rate limit'},429);
 const tool=req.nextUrl.searchParams.get('tool');
 if(tool!=='recentContacts'&&tool!=='followUpsDue')return reply({error:'Unsupported tool'},400);
 const org=await resolveOrganizationContext(user.id);
 if(org&&!hasOrganizationPermission(org,'crm.view'))return reply({error:'CRM permission required'},403);
 const ctx=await buildWorkspaceContext(user,await getServerLang());
 if(!contextHasCrmAccess(ctx))return reply({error:'CRM add-on required'},402);
 const result=tool==='recentContacts'?await crmRecentContacts.run({days:1},ctx):await crmFollowUpsDue.run({},ctx);
 return reply({tool,...result,generatedAt:new Date().toISOString(),credits:0,limits:{recentContacts:15,followUpsDue:20}});
}
