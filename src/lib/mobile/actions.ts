import {prisma} from "@/lib/db/prisma";
import {buildWorkspaceContext} from "@/lib/orchestrator/isolation";
import type {Lang} from "@/lib/i18n";
export async function accessibleMobileActions(user:{id:string;plan:string;voicePlan?:string|null},lang:Lang,id?:string){
 const ctx=await buildWorkspaceContext(user,lang);
 const rows=await prisma.orchestratorAction.findMany({where:{actingUserId:user.id,workspaceUserId:ctx.workspaceUserId,toolKey:'crm.updateDealStage',...(id?{id}:{})},orderBy:{createdAt:'desc'},take:id?1:50});
 const candidates=rows.flatMap(action=>{try{const args=JSON.parse(action.argsJson);return typeof args.resolved?.dealId==='string'?[{action,dealId:args.resolved.dealId}]:[];}catch{return [];}});
 const deals=await prisma.crmDeal.findMany({where:{id:{in:candidates.map(c=>c.dealId)},userId:ctx.workspaceUserId,...ctx.businessFilter,...ctx.dealFilter},select:{id:true}});const allowed=new Set(deals.map(d=>d.id));
 return candidates.filter(c=>allowed.has(c.dealId)).map(({action})=>({id:action.id,summary:action.summary,toolKey:action.toolKey,status:action.status,expiresAt:action.expiresAt,expired:action.expiresAt<=new Date(),credits:0}));
}
