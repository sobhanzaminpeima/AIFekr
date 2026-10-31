export const dynamic='force-dynamic';
import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse,forbiddenResponse} from '@/lib/auth/middleware';
import {resolveOrganizationContext} from '@/lib/organization/context';
import {prisma} from '@/lib/db/prisma';
export async function GET(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const ctx=await resolveOrganizationContext(user.id,req.nextUrl.searchParams.get('businessId'));if(!ctx)return forbiddenResponse(req);
 const manage=ctx.permissions.has('team.manage')||ctx.role==='OWNER';
 const [business,members,audits,flags]=await Promise.all([
  prisma.businessWorkspace.findUnique({where:{id:ctx.businessId},select:{id:true,name:true,industry:true,country:true,timezone:true,currency:true,language:true,description:true,modules:true,status:true}}),
  manage?prisma.businessMember.findMany({where:{businessId:ctx.businessId},select:{id:true,role:true,status:true,createdAt:true,permissions:true,user:{select:{id:true,name:true,email:true}}},orderBy:{createdAt:'asc'}}):Promise.resolve([]),
  manage?prisma.organizationAuditLog.findMany({where:{organizationId:ctx.organizationId,businessId:ctx.businessId},orderBy:{createdAt:'desc'},take:100,select:{id:true,action:true,targetType:true,createdAt:true}}):Promise.resolve([]),
  prisma.organizationFeatureFlag.findMany({where:{organizationId:ctx.organizationId},select:{key:true,enabled:true}})
 ]);
 return NextResponse.json({business,audits,flags,permissions:Array.from(ctx.permissions),role:ctx.role,canManageTeam:manage,members:members.map(m=>({...m,userId:m.user.id,name:m.user.name,email:m.user.email,user:undefined}))});
}
