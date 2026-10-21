import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {mobileIdentity} from '@/lib/auth/mobileSessions';
import {prisma} from '@/lib/db/prisma';
export const dynamic='force-dynamic';
export async function PUT(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const identity=await mobileIdentity((req.headers.get('authorization')||'').replace(/^Bearer /,''));
 if(!identity||identity.userId!==user.id)return NextResponse.json({error:'Native session required'},{status:401});
 let token:string|null;try{token=z.object({token:z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,160}\]$/).nullable()}).strict().parse(await req.json()).token;}catch{return NextResponse.json({error:'Invalid push token'},{status:400});}
 const updated=await prisma.$transaction(async tx=>{
  const changed=await tx.mobileSession.updateMany({where:{id:identity.sessionId,userId:user.id,revokedAt:null,expiresAt:{gt:new Date()}},data:{pushToken:token,pushEnabledAt:token?new Date():null}});
  if(changed.count===1&&token)await tx.mobileSession.updateMany({where:{pushToken:token,id:{not:identity.sessionId}},data:{pushToken:null,pushEnabledAt:null}});
  return changed;
 });
 if(updated.count!==1)return NextResponse.json({error:'Session revoked'},{status:401});
 return NextResponse.json({enabled:!!token,deliveryConfigured:process.env.MOBILE_PUSH_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}});
}
