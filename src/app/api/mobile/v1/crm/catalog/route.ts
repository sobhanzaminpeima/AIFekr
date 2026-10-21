import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import {resolveCrmWorkspace,businessFilter} from '@/lib/crm/workspace';
import {resolveOrganizationContext,hasOrganizationPermission} from '@/lib/organization/context';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const org=await resolveOrganizationContext(user.id);if(org&&!hasOrganizationPermission(org,'crm.view'))return NextResponse.json({error:'CRM read permission required'},{status:403});const ws=await resolveCrmWorkspace(user.id);const pipelines=await prisma.crmPipeline.findMany({where:{userId:ws.workspaceUserId,...businessFilter(ws)},select:{id:true,name:true,stages:{orderBy:{order:'asc'},select:{id:true,name:true,isWon:true,isLost:true}}},take:50});return NextResponse.json({pipelines},{headers:{'Cache-Control':'no-store'}});}
