export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import {buildWorkspaceContext} from '@/lib/orchestrator/isolation';
import {getServerLang} from '@/lib/i18n/server';
/** Same acting-person/workspace boundary as the execution endpoint; never expose stored arguments. */
export async function GET(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const ctx=await buildWorkspaceContext({id:user.id,plan:user.plan,voicePlan:user.voicePlan},await getServerLang());
 const [actions,conversations]=await Promise.all([
  prisma.orchestratorAction.findMany({where:{workspaceUserId:ctx.workspaceUserId,actingUserId:ctx.actingUserId},orderBy:{createdAt:'desc'},take:100,select:{id:true,summary:true,toolKey:true,status:true,expiresAt:true,createdAt:true,conversationId:true}}),
  prisma.conversation.findMany({where:{userId:user.id,tool:'ceo'},orderBy:{updatedAt:'desc'},take:50,select:{id:true,title:true,updatedAt:true}})
 ]);
 return NextResponse.json({actions:actions.map(a=>({...a,expired:a.status==='PENDING'&&a.expiresAt.getTime()<Date.now()})),conversations});
}
