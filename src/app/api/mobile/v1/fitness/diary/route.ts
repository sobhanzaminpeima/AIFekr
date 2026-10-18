import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {fitnessAccess} from '@/lib/fitness/service';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function identity(req:NextRequest){if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};if(!await fitnessAccess(user.id,user.role))return {error:reply({error:'FITNESS_SUBSCRIPTION_REQUIRED'},402)};return {user};}
export async function GET(req:NextRequest){const auth=await identity(req);if(auth.error)return auth.error;const diary=await prisma.fitnessDiary.findMany({where:{userId:auth.user!.id},orderBy:{day:'desc'},take:50,select:{id:true,kind:true,content:true,day:true}});return reply({diary});}
export async function POST(req:NextRequest){
 const auth=await identity(req);if(auth.error)return auth.error;const user=auth.user!;
 if(!rateLimit(`native-fit-diary:${user.id}`,30,60000).allowed)return reply({error:'Too many requests'},429);
 let body:{kind:'MEAL'|'HYDRATION'|'RECOVERY'|'NOTE';content:string;day:string;requestKey:string;consent:true};try{body=z.object({kind:z.enum(['MEAL','HYDRATION','RECOVERY','NOTE']),content:z.string().trim().min(1).max(2000),day:z.string().datetime(),requestKey:z.string().regex(/^fit_diary_[a-zA-Z0-9_-]{8,100}$/),consent:z.literal(true)}).strict().parse(await req.json());}catch{return reply({error:'Invalid entry or missing consent'},400);}
 const hash=createHash('sha256').update(JSON.stringify({kind:body.kind,content:body.content,day:body.day})).digest('hex');
 try{return await prisma.$transaction(async tx=>{const prior=await tx.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:body.requestKey}}});if(prior)return prior.inputHash===hash&&prior.responseJson?reply(JSON.parse(prior.responseJson)):reply({error:'Request key already used'},409);const claim=await tx.mobileRequest.create({data:{userId:user.id,requestKey:body.requestKey,inputHash:hash,status:'RUNNING'}});const entry=await tx.fitnessDiary.create({data:{userId:user.id,kind:body.kind,content:body.content,day:new Date(body.day)}});await tx.auditLog.create({data:{actorId:user.id,action:'fitness_diary_saved',targetId:entry.id,metadata:JSON.stringify({consent:true,kind:body.kind})}});const result={entry};await tx.mobileRequest.update({where:{id:claim.id},data:{status:'COMPLETED',responseJson:JSON.stringify(result)}});return reply(result,201);});}catch{return reply({error:'Already submitted or unavailable; refresh diary'},409);}
}
