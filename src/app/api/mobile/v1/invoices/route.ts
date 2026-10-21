import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {resolveCrmWorkspace,hasCrmAccess,businessFilter} from '@/lib/crm/workspace';
import {resolveOrganizationContext,hasOrganizationPermission} from '@/lib/organization/context';
import {computeInvoiceTotals,createInvoiceWithNumber} from '@/lib/repositories/crmInvoiceRepository';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function access(req:NextRequest,write=false){
 if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};const ws=await resolveCrmWorkspace(user.id);
 if(ws.isAgentRestricted)return {error:reply({error:'Workspace manager required'},403)};if(!hasCrmAccess(ws))return {error:reply({error:'CRM add-on required'},402)};
 if(!rateLimit(`mobile-invoice:${write?'write':'read'}:${user.id}`,write?30:60,60000).allowed)return {error:reply({error:'Rate limit'},429)};
 const org=await resolveOrganizationContext(user.id);if(org&&!hasOrganizationPermission(org,write?'crm.edit':'crm.view'))return {error:reply({error:'CRM permission required'},403)};return {user,ws};
}
const id=z.string().min(1).max(100),amount=z.number().finite().nonnegative().max(1e12),date=z.string().datetime({offset:true});
const data=z.object({contactId:id,items:z.array(z.object({description:z.string().trim().min(1).max(500),quantity:z.number().finite().positive().max(1e6),unitPrice:amount,taxRate:z.number().finite().min(0).max(100)}).strict()).min(1).max(50),discount:amount,currency:z.enum(['IRT','IRR','USD','GBP','EUR','TRY']),notes:z.string().max(4000),dueDate:date.nullable()}).strict();
const base=z.object({requestKey:z.string().regex(/^invoice_[a-zA-Z0-9_-]{8,100}$/),context:z.object({workspaceUserId:id,businessId:id.nullable()}).strict(),data});
const input=z.discriminatedUnion('action',[base.extend({action:z.literal('create')}).strict(),base.extend({action:z.literal('update'),id,version:date}).strict()]);
export async function GET(req:NextRequest){const auth=await access(req);if(auth.error)return auth.error;const ws=auth.ws!;const [invoices,contacts]=await Promise.all([prisma.crmInvoice.findMany({where:{userId:ws.workspaceUserId,...businessFilter(ws)},include:{items:true,contact:{select:{id:true,name:true}}},orderBy:{updatedAt:'desc'},take:100}),prisma.crmContact.findMany({where:{userId:ws.workspaceUserId,...businessFilter(ws)},select:{id:true,name:true},orderBy:{name:'asc'},take:500})]);return reply({context:{workspaceUserId:ws.workspaceUserId,businessId:ws.businessId},invoices:invoices.map(row=>({...row,version:row.updatedAt.toISOString()})),contacts,limit:100});}
class InvoiceError extends Error{constructor(public status:number,message:string){super(message);}}
export async function POST(req:NextRequest){const auth=await access(req,true);if(auth.error)return auth.error;const ws=auth.ws!,userId=auth.user!.id;let body:z.infer<typeof input>;try{body=input.parse(await req.json());}catch{return reply({error:'Invalid invoice request'},400);}
 if(body.context.workspaceUserId!==ws.workspaceUserId||body.context.businessId!==ws.businessId)return reply({error:'Workspace changed; reload before saving'},409);
 const totals=computeInvoiceTotals(body.data.items);const total=totals.subtotal+totals.taxTotal-body.data.discount;
 if(!Number.isFinite(total)||total<0||total>1e12)return reply({error:'Invoice total or discount is out of range'},400);
 const inputHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 try{return await prisma.$transaction(async tx=>{
  const oldRequest=await tx.mobileRequest.findUnique({where:{userId_requestKey:{userId,requestKey:body.requestKey}}});if(oldRequest){if(oldRequest.inputHash!==inputHash)throw new InvoiceError(409,'Request changed');return reply(JSON.parse(oldRequest.responseJson||'{}'));}
  if(!await tx.crmContact.findFirst({where:{id:body.data.contactId,userId:ws.workspaceUserId,...businessFilter(ws)},select:{id:true}}))throw new InvoiceError(404,'Contact not found');
  const values={subtotal:totals.subtotal,taxTotal:totals.taxTotal,total,discount:body.data.discount,currency:body.data.currency,notes:body.data.notes,dueDate:body.data.dueDate?new Date(body.data.dueDate):null};let invoiceId:string;
  if(body.action==='create'){const invoice=await createInvoiceWithNumber(ws.workspaceUserId,{...values,...businessFilter(ws),contact:{connect:{id:body.data.contactId}},items:{create:totals.itemsData}},5,ws.businessId,tx);invoiceId=invoice.id;}
  else{const existing=await tx.crmInvoice.findFirst({where:{id:body.id,userId:ws.workspaceUserId,...businessFilter(ws)}});if(!existing)throw new InvoiceError(404,'Invoice not found');if(existing.status!=='draft'||existing.updatedAt.toISOString()!==body.version)throw new InvoiceError(409,'Only an unchanged draft can be edited');
   const changed=await tx.crmInvoice.updateMany({where:{id:existing.id,userId:ws.workspaceUserId,...businessFilter(ws),status:'draft',updatedAt:existing.updatedAt},data:{...values,contactId:body.data.contactId,updatedAt:new Date(Math.max(Date.now(),existing.updatedAt.getTime()+1))}});if(!changed.count)throw new InvoiceError(409,'Invoice changed');await tx.crmInvoiceItem.deleteMany({where:{invoiceId:existing.id}});await tx.crmInvoiceItem.createMany({data:totals.itemsData.map(row=>({...row,invoiceId:existing.id}))});invoiceId=existing.id;
  }
  const result={id:invoiceId,status:'draft',total,currency:body.data.currency};await tx.mobileRequest.create({data:{userId,requestKey:body.requestKey,inputHash,status:'COMPLETED',responseJson:JSON.stringify(result)}});await tx.auditLog.create({data:{actorId:userId,action:`mobile.invoice.${body.action}`,targetId:invoiceId,metadata:JSON.stringify({businessId:ws.businessId})}});return reply(result);
 });}catch(error){return error instanceof InvoiceError?reply({error:error.message},error.status):reply({error:'Invoice save unconfirmed; retry the same request key'},503);}
}
