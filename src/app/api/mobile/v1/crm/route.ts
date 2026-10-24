import {createHash} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import {resolveCrmWorkspace,agentFilter,businessFilter,dealAgentFilter} from '@/lib/crm/workspace';
import {POST as createContact} from '@/app/api/crm/contacts/route';
import {PUT as editContact} from '@/app/api/crm/contacts/[id]/route';
import {POST as createTask,PUT as editTask} from '@/app/api/crm/tasks/route';
import {PUT as editDeal} from '@/app/api/crm/deals/[id]/route';
import {POST as createDeal} from '@/app/api/crm/deals/route';
import {POST as moveDeal} from '@/app/api/crm/deals/[id]/move/route';
import {rateLimit} from '@/lib/utils/rateLimit';
import {resolveOrganizationContext,hasOrganizationPermission} from '@/lib/organization/context';
export const dynamic='force-dynamic';
const key=z.string().regex(/^crm_[a-zA-Z0-9_-]{12,100}$/),id=z.string().min(1).max(100);
const contact=z.object({name:z.string().trim().min(1).max(120),phone:z.string().trim().max(40).default(''),email:z.union([z.literal(''),z.email()]).default(''),company:z.string().trim().max(160).default('')}).strict();
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('contact.create'),requestKey:key,data:contact}).strict(),
 z.object({action:z.literal('contact.update'),requestKey:key,id,data:contact}).strict(),
 z.object({action:z.literal('task.create'),requestKey:key,data:z.object({title:z.string().trim().min(1).max(200),contactId:id.optional(),dueDate:z.iso.datetime().optional()}).strict()}).strict(),
 z.object({action:z.literal('task.update'),requestKey:key,id,data:z.object({status:z.enum(['pending','done']),title:z.string().trim().min(1).max(200).optional()}).strict()}).strict(),
 z.object({action:z.literal('deal.update'),requestKey:key,id,data:z.object({title:z.string().trim().min(1).max(200),probability:z.number().int().min(0).max(100)}).strict()}).strict(),
 z.object({action:z.literal('deal.create'),requestKey:key,data:z.object({title:z.string().trim().min(1).max(200),contactId:id,pipelineId:id,stageId:id,probability:z.number().int().min(0).max(100).default(50)}).strict()}).strict(),
 z.object({action:z.literal('deal.move'),requestKey:key,id,data:z.object({stageId:id,lostReason:z.string().trim().max(1000).optional()}).strict()}).strict(),
]);
export async function POST(req:NextRequest){
 if(process.env.MOBILE_API_ENABLED!=='true')return NextResponse.json({error:'Mobile disabled'},{status:503});
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);if(!rateLimit(`native-crm:${user.id}`,30,60000).allowed)return NextResponse.json({error:'Too many requests'},{status:429});
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Invalid CRM request'},{status:400});const body=parsed.data;const ws=await resolveCrmWorkspace(user.id);
 const organization=await resolveOrganizationContext(user.id);if(organization&&!hasOrganizationPermission(organization,'crm.edit'))return NextResponse.json({error:'CRM write permission required'},{status:403});
 if(body.action==='deal.move'&&!await prisma.crmDeal.findFirst({where:{id:body.id,userId:ws.workspaceUserId,...businessFilter(ws),...dealAgentFilter(ws)},select:{id:true}}))return NextResponse.json({error:'Deal not found'},{status:404});
 const hash=createHash('sha256').update(JSON.stringify({body,workspace:ws.workspaceUserId,businessId:ws.businessId})).digest('hex');
 const existing=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:body.requestKey}}});
 if(existing){if(existing.inputHash!==hash)return NextResponse.json({error:'Request or workspace changed'},{status:409});if(existing.status==='COMPLETED')return NextResponse.json({success:true,replayed:true});return NextResponse.json({error:'Already submitted; inspect records before retrying',status:existing.status},{status:409});}
 if(body.action==='contact.create'&&(body.data.email||body.data.phone)){
  const duplicate=await prisma.crmContact.findFirst({where:{userId:ws.workspaceUserId,...businessFilter(ws),...agentFilter(ws),OR:[...(body.data.email?[{email:body.data.email}]:[]),...(body.data.phone?[{phone:body.data.phone}]:[])]},select:{id:true}});
  if(duplicate)return NextResponse.json({error:'A matching contact already exists',code:'DUPLICATE_CONTACT'},{status:409});
 }
 let claim;try{claim=await prisma.mobileRequest.create({data:{userId:user.id,requestKey:body.requestKey,inputHash:hash}});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return NextResponse.json({error:'Request already submitted'},{status:409});throw error;}
 try{
  const forwarded=new NextRequest(req.url,{method:body.action.endsWith('.create')||body.action==='deal.move'?'POST':'PUT',headers:req.headers,body:JSON.stringify(body.action==='task.update'?{id:body.id,...body.data}:body.data)});
  const response=body.action==='contact.create'?await createContact(forwarded):body.action==='contact.update'?await editContact(forwarded,{params:Promise.resolve({id:body.id})}):body.action==='task.create'?await createTask(forwarded):body.action==='task.update'?await editTask(forwarded):body.action==='deal.create'?await createDeal(forwarded):body.action==='deal.move'?await moveDeal(forwarded,{params:Promise.resolve({id:body.id})}):await editDeal(forwarded,{params:Promise.resolve({id:body.id})});
  const result=await response.json();await prisma.mobileRequest.update({where:{id:claim.id},data:{status:response.ok?'COMPLETED':'FAILED',responseJson:JSON.stringify({action:body.action,businessId:ws.businessId,result})}});
  if(response.ok)await prisma.auditLog.create({data:{actorId:user.id,action:`mobile.${body.action}`,targetId:'id' in body?body.id:result.contact?.id||result.task?.id||result.deal?.id||claim.id,metadata:JSON.stringify({requestId:claim.id,businessId:ws.businessId})}});
  return NextResponse.json(result,{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch{await prisma.mobileRequest.updateMany({where:{id:claim.id,status:'RUNNING'},data:{status:'UNKNOWN'}});return NextResponse.json({error:'Request interrupted; inspect records before retrying'},{status:503});}
}
