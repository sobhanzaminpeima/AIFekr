import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {resolveCrmWorkspace,hasCrmAccess,businessFilter} from '@/lib/crm/workspace';
import {resolveOrganizationContext,hasOrganizationPermission} from '@/lib/organization/context';
import {isModuleEnabled} from '@/lib/industry/moduleAccess';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function access(req:NextRequest,write=false){
 if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};
 if(!rateLimit(`mobile-property:${write?'write':'read'}:${user.id}`,write?30:60,60000).allowed)return {error:reply({error:'Rate limit'},429)};
 const ws=await resolveCrmWorkspace(user.id);if(ws.isAgentRestricted)return {error:reply({error:'Workspace manager required'},403)};if(!hasCrmAccess(ws))return {error:reply({error:'CRM add-on required'},402)};
 const org=await resolveOrganizationContext(user.id);if(org&&!hasOrganizationPermission(org,write?'crm.edit':'crm.view'))return {error:reply({error:'CRM permission required'},403)};
 const owner=await prisma.user.findUnique({where:{id:ws.workspaceUserId},select:{industryPackId:true}});if(!await isModuleEnabled({id:user.id,role:user.role,industryPackId:owner?.industryPackId??null},'crm.property'))return {error:reply({error:'Property module required'},403)};
 return {user,ws};
}
const id=z.string().min(1).max(100),money=z.string().regex(/^\d{1,15}$/),context=z.object({workspaceUserId:id,businessId:id.nullable()}).strict();
const fields=z.object({title:z.string().trim().min(1).max(200),listingType:z.enum(['buy','sell','rent','short_term_rent']),propertyType:z.string().trim().min(1).max(40),price:money,nightlyPrice:money.nullable(),currency:z.enum(['IRT','IRR','USD','GBP','EUR','TRY']),address:z.string().trim().min(1).max(500),city:z.string().trim().max(100),description:z.string().max(10000),status:z.enum(['available','pending','sold','rented']),crmContactId:id.nullable()}).strict();
const base=z.object({requestKey:z.string().regex(/^property_[a-zA-Z0-9_-]{8,100}$/),context,data:fields});
const input=z.discriminatedUnion('action',[base.extend({action:z.literal('create')}).strict(),base.extend({action:z.literal('update'),id,version:z.string().datetime({offset:true})}).strict()]);
export async function GET(req:NextRequest){const auth=await access(req);if(auth.error)return auth.error;const ws=auth.ws!;const [properties,contacts]=await Promise.all([prisma.property.findMany({where:{userId:ws.workspaceUserId,...businessFilter(ws)},orderBy:{updatedAt:'desc'},take:100,select:{id:true,title:true,listingType:true,propertyType:true,price:true,nightlyPrice:true,currency:true,address:true,city:true,description:true,status:true,crmContactId:true,updatedAt:true}}),prisma.crmContact.findMany({where:{userId:ws.workspaceUserId,...businessFilter(ws)},select:{id:true,name:true},take:500,orderBy:{name:'asc'}})]);
 return reply({context:{workspaceUserId:ws.workspaceUserId,businessId:ws.businessId},properties:properties.map(row=>({...row,price:row.price.toString(),nightlyPrice:row.nightlyPrice?.toString()??null,version:row.updatedAt.toISOString()})),contacts,limit:100});}
class SaveError extends Error{constructor(public status:number,message:string){super(message);}}
export async function POST(req:NextRequest){const auth=await access(req,true);if(auth.error)return auth.error;const ws=auth.ws!,userId=auth.user!.id;let body:z.infer<typeof input>;try{body=input.parse(await req.json());}catch{return reply({error:'Invalid property request'},400);}
 if(body.context.workspaceUserId!==ws.workspaceUserId||body.context.businessId!==ws.businessId)return reply({error:'Workspace changed; reload before saving'},409);
 if(body.data.listingType==='short_term_rent'&&(!body.data.nightlyPrice||BigInt(body.data.nightlyPrice)===BigInt(0)))return reply({error:'A positive nightly price is required'},400);
 const inputHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 try{return await prisma.$transaction(async tx=>{
  const prior=await tx.mobileRequest.findUnique({where:{userId_requestKey:{userId,requestKey:body.requestKey}}});if(prior){if(prior.inputHash!==inputHash)throw new SaveError(409,'Request changed');return reply(JSON.parse(prior.responseJson||'{}'));}
  if(body.data.crmContactId&&!await tx.crmContact.findFirst({where:{id:body.data.crmContactId,userId:ws.workspaceUserId,...businessFilter(ws)},select:{id:true}}))throw new SaveError(404,'Contact not found');
  const {listingType,price,nightlyPrice,...rest}=body.data;const values={...rest,price:listingType==='short_term_rent'?BigInt(0):BigInt(price),nightlyPrice:listingType==='short_term_rent'&&nightlyPrice?BigInt(nightlyPrice):null};let propertyId:string;
  if(body.action==='create'){const property=await tx.property.create({data:{...values,listingType,userId:ws.workspaceUserId,...businessFilter(ws),ownerContactId:listingType==='short_term_rent'?body.data.crmContactId:null}});propertyId=property.id;}
  else{const old=await tx.property.findFirst({where:{id:body.id,userId:ws.workspaceUserId,...businessFilter(ws)}});if(!old)throw new SaveError(404,'Property not found');if(old.updatedAt.toISOString()!==body.version||old.listingType!==listingType)throw new SaveError(409,'Property changed; reload before editing');const changed=await tx.property.updateMany({where:{id:old.id,userId:ws.workspaceUserId,...businessFilter(ws),updatedAt:old.updatedAt},data:{...values,...(listingType==='short_term_rent'&&!old.ownerContactId&&body.data.crmContactId?{ownerContactId:body.data.crmContactId}:{}),updatedAt:new Date(Math.max(Date.now(),old.updatedAt.getTime()+1))}});if(!changed.count)throw new SaveError(409,'Property changed');propertyId=old.id;}
  const result={id:propertyId};await tx.mobileRequest.create({data:{userId,requestKey:body.requestKey,inputHash,status:'COMPLETED',responseJson:JSON.stringify(result)}});await tx.auditLog.create({data:{actorId:userId,action:`mobile.property.${body.action}`,targetId:propertyId,metadata:JSON.stringify({businessId:ws.businessId})}});return reply(result);
 });}catch(error){return error instanceof SaveError?reply({error:error.message},error.status):reply({error:'Save unconfirmed; retry the same request key'},503);}
}
