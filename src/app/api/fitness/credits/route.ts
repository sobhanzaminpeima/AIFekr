import {getFxRates} from "@/lib/utils/currency";
export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
export async function GET(req:NextRequest){
 const auth=await requireAuth(req);if(!auth)return unauthorizedResponse(req);
 const user=await prisma.user.findUniqueOrThrow({where:{id:auth.id},select:{fitnessAccessExpiry:true,credits:true,aiCredits:true,mediaCredits:true,voiceMinutes:true,fitnessProfile:{select:{entitlementExpiry:true}}}});
 const rows=await prisma.usageLog.groupBy({by:["type"],where:{userId:auth.id,createdAt:{gte:new Date(Date.now()-30*86400000)},metadata:{contains:'"feature":"fitness"'}},_sum:{credits:true,estimatedCostUsd:true},_count:{_all:true}});
 return NextResponse.json({fxRates:await getFxRates(),user:{credits:user.credits,displayCredits:user.credits,plan:"AIFekr FIT",planExpiry:[user.fitnessAccessExpiry,user.fitnessProfile?.entitlementExpiry].filter((d):d is Date=>!!d).sort((a,b)=>b.getTime()-a.getTime())[0]},wallets:{aiCredits:user.aiCredits,mediaCredits:user.mediaCredits,voiceMinutes:user.voiceMinutes},breakdown:rows.map(r=>({type:r.type,count:r._count._all,creditsSpent:r._sum.credits||0,estimatedCostUsd:r._sum.estimatedCostUsd||0}))});
}
