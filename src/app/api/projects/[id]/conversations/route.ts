export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
type Context={params:Promise<{id:string}>};
async function move(req:NextRequest,ctx:Context,remove:boolean){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const {id}=await ctx.params;const body=await req.json().catch(()=>null);
 if(typeof body?.conversationId!=="string")return NextResponse.json({error:"INVALID_CONVERSATION"},{status:400});
 const result=await prisma.$transaction(async tx=>{
  if(!await tx.project.findFirst({where:{id,userId:user.id},select:{id:true}}))return null;
  return tx.conversation.updateMany({where:{id:body.conversationId,userId:user.id,...(remove?{projectId:id}:{})},data:{projectId:remove?null:id}});
 });
 if(!result?.count)return NextResponse.json({error:"NOT_FOUND"},{status:404});
 return NextResponse.json({success:true,projectId:remove?null:id});
}
export const POST=(req:NextRequest,ctx:Context)=>move(req,ctx,false);
export const DELETE=(req:NextRequest,ctx:Context)=>move(req,ctx,true);
