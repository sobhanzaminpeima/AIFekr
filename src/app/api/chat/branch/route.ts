import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
/** Preserve the original thread. Copy only context before the edited user turn. */
export async function POST(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`chat-branch:${user.id}`,10,60000).allowed)return NextResponse.json({error:'RATE_LIMITED'},{status:429});
 const body=await req.json().catch(()=>null);
 if(typeof body?.conversationId!=='string'||typeof body?.messageId!=='string')return NextResponse.json({error:'INVALID_INPUT'},{status:400});
 const result=await prisma.$transaction(async tx=>{
  const source=await tx.conversation.findFirst({where:{id:body.conversationId,userId:user.id},select:{id:true,title:true,model:true,tool:true,projectId:true,businessId:true}});
  if(!source||source.tool?.startsWith('student:'))return null;
  const messages=await tx.message.findMany({where:{conversationId:source.id},orderBy:[{createdAt:'asc'},{id:'asc'}],take:1001});
  if(messages.length>1000)return {tooLong:true} as const;
  const index=messages.findIndex(m=>m.id===body.messageId&&m.role==='user');if(index<0)return null;
  const project=source.projectId?await tx.project.findFirst({where:{id:source.projectId,userId:user.id},select:{id:true}}):null;
  const conversation=await tx.conversation.create({data:{userId:user.id,title:source.title,model:source.model,tool:source.tool,projectId:project?.id??null,businessId:source.businessId}});
  // No executable actions or routing state are copied into a new branch.
  for(const m of messages.slice(0,index))await tx.message.create({data:{conversationId:conversation.id,role:m.role,content:m.content,createdAt:m.createdAt}});
  return {conversation};
 });
 if(!result)return NextResponse.json({error:'NOT_FOUND'},{status:404});
 if('tooLong' in result)return NextResponse.json({error:'THREAD_TOO_LONG'},{status:413});
 return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
}
