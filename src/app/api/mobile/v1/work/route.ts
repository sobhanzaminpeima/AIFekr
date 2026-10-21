import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {resolveCrmWorkspace} from '@/lib/crm/workspace';
import {hasVoiceAccess} from '@/lib/voice/workspace';
import {GET as properties} from '@/app/api/crm/properties/route';
import {GET as invoices} from '@/app/api/crm/invoices/route';
import {GET as calls} from '@/app/api/voice-agent/calls/route';
import {GET as appointments} from '@/app/api/voice-agent/appointments/route';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const moduleKey=req.nextUrl.searchParams.get('module');if(moduleKey==='properties'||moduleKey==='rentals'){const url=new URL('/api/crm/properties',req.url);if(moduleKey==='rentals')url.searchParams.set('listingType','short_term_rent');return properties(new NextRequest(url,{headers:req.headers}));}if(moduleKey==='invoices'){const ws=await resolveCrmWorkspace(user.id);if(ws.isAgentRestricted)return NextResponse.json({error:'Finance is restricted to workspace managers'},{status:403});return invoices(req);}if(moduleKey==='calls'||moduleKey==='appointments'){if(!hasVoiceAccess(user))return NextResponse.json({error:'Voice add-on required'},{status:402});return moduleKey==='calls'?calls(req):appointments(req);}return NextResponse.json({error:'Unknown moduleKey'},{status:400});}

