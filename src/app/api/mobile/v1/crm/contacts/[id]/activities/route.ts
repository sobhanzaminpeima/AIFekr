import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import {resolveCrmWorkspace,agentFilter,businessFilter} from '@/lib/crm/workspace';
import {resolveOrganizationContext,hasOrganizationPermission} from '@/lib/organization/context';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const input=z.object({requestKey:z.string().regex(/^activity_[a-zA-Z0-9_-]{8,100}$/),type:z.enum(['call','meeting','note']),content:z.string().trim().min(1).max(4000),context:z.object({workspaceUserId:z.string(),businessId:z.string().nullable()}).strict()}).strict();
export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 if(process.env.MOBILE_API_ENABLED!=='true')return reply({error:'Mobile API disabled'},503);const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const ws=await resolveCrmWorkspace(user.id);const org=await resolveOrganizationContext(user.id);if(org&&!hasOrganizationPermission(org,'crm.edit'))return reply({error:'CRM write permission required'},403);
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return reply({error:'Invalid activity'},400);const body=parsed.data;
 if(!rateLimit(`mobile-activity:${user.id}`,30,60000).allowed)return reply({error:'Rate limit'},429);
 if(body.context.workspaceUserId!==ws.workspaceUserId||body.context.businessId!==ws.businessId)return reply({error:'Workspace changed; reload contact'},409);
 const scope={id:params.id,userId:ws.workspaceUserId,...businessFilter(ws),...agentFilter(ws)};
 if(!await prisma.crmContact.findFirst({where:scope,select:{id:true}}))return reply({error:'Contact not found'},404);
 const inputHash=createHash('sha256').update(JSON.stringify({contactId:params.id,...body})).digest('hex');
 try{return await prisma.$transaction(async tx=>{const old=await tx.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:body.requestKey}}});if(old)return old.inputHash===inputHash?reply(JSON.parse(old.responseJson||'{}')):reply({error:'Request changed'},409);
  if(!await tx.crmContact.findFirst({where:scope,select:{id:true}}))return reply({error:'Contact no longer available'},404);
  const activity=await tx.crmActivity.create({data:{userId:ws.workspaceUserId,...businessFilter(ws),contactId:params.id,type:body.type,content:body.content}});const result={id:activity.id};await tx.mobileRequest.create({data:{userId:user.id,requestKey:body.requestKey,inputHash,status:'COMPLETED',responseJson:JSON.stringify(result)}});await tx.auditLog.create({data:{actorId:user.id,action:'mobile.activity.create',targetId:activity.id,metadata:JSON.stringify({businessId:ws.businessId,type:body.type})}});return reply(result);
 });}catch{return reply({error:'Save unconfirmed; retry the same request key'},503);}
}
