import {randomBytes,createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const schema=z.object({requestKey:z.string().regex(/^group_manage_[a-zA-Z0-9_-]{8,100}$/),action:z.enum(['rotate','remove','leave','transfer']),userId:z.string().max(100).optional()}).strict();
async function identity(req:NextRequest){if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};const denied=await studentWorkspaceDisabledResponse(user);return denied?{error:denied}:{user};}
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const auth=await identity(req);if(auth.error)return auth.error;const user=auth.user!;
 const group=await prisma.studentStudyGroup.findFirst({where:{id:params.id,members:{some:{userId:user.id}}},select:{ownerId:true,members:{select:{userId:true,user:{select:{name:true}}},take:200}}});
 if(!group)return reply({error:'Group not found'},404);
 return reply({canManage:group.ownerId===user.id,members:group.members.map(member=>({userId:member.userId,name:member.user.name,isOwner:member.userId===group.ownerId,isSelf:member.userId===user.id}))});
}
export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 const auth=await identity(req);if(auth.error)return auth.error;const user=auth.user!;
 if(!rateLimit(`native-group-manage:${user.id}`,30,60000).allowed)return reply({error:'Too many requests'},429);
 let body:z.infer<typeof schema>;try{body=schema.parse(await req.json());}catch{return reply({error:'Invalid action'},400);}
 const hash=createHash('sha256').update(JSON.stringify({groupId:params.id,action:body.action,userId:body.userId})).digest('hex');
 try{return await prisma.$transaction(async tx=>{
  const group=await tx.studentStudyGroup.findFirst({where:{id:params.id,members:{some:{userId:user.id}}},select:{ownerId:true}});
  if(!group)return reply({error:'Group not found'},404);
  if(body.action!=='leave'&&group.ownerId!==user.id)return reply({error:'Only the owner can manage this group'},403);
  if(body.action==='leave'&&group.ownerId===user.id)return reply({error:'Owner must transfer ownership before leaving'},409);
  if(body.action==='remove'&&(!body.userId||body.userId===group.ownerId))return reply({error:'Cannot remove the owner'},400);
  if(body.action==='transfer'&&(!body.userId||body.userId===group.ownerId||!await tx.studentStudyGroupMember.findUnique({where:{groupId_userId:{groupId:params.id,userId:body.userId}}})))return reply({error:'New owner must be another current member'},400);
  const prior=await tx.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:body.requestKey}}});
  if(prior){if(prior.inputHash!==hash)return reply({error:'Request key already used'},409);return reply(prior.responseJson?JSON.parse(prior.responseJson):{error:'Already submitted'},prior.status==='COMPLETED'?200:409);}
  const claim=await tx.mobileRequest.create({data:{userId:user.id,requestKey:body.requestKey,inputHash:hash,status:'RUNNING'}});
  let inviteCode:string|undefined;
  if(body.action==='rotate'){inviteCode=randomBytes(24).toString('base64url');await tx.studentStudyGroup.update({where:{id:params.id},data:{inviteCode}});}else if(body.action==='transfer'){await tx.studentStudyGroup.update({where:{id:params.id},data:{ownerId:body.userId!}});}else await tx.studentStudyGroupMember.deleteMany({where:{groupId:params.id,userId:body.action==='leave'?user.id:body.userId}});
  await tx.auditLog.create({data:{actorId:user.id,action:`student_group_${body.action}`,targetId:params.id,metadata:JSON.stringify({userId:body.action==='remove'||body.action==='transfer'?body.userId:undefined})}});
  const result={success:true,...(inviteCode?{inviteCode}:{})};await tx.mobileRequest.update({where:{id:claim.id},data:{status:'COMPLETED',responseJson:JSON.stringify(result)}});return reply(result);
 });}catch{return reply({error:'Operation could not be completed; refresh group state'},409);}
}

