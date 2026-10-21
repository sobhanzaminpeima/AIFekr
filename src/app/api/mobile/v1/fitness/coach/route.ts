import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {fitnessAccess} from '@/lib/fitness/service';
import {FIT_COACH_MAX_CREDITS} from '@/lib/fitness/coachContract';
import {getEnabledProviders} from '@/lib/ai/router';
import {getAvailableCredits} from '@/lib/utils/teamCredits';
import {POST as coach} from '@/app/api/fitness/coach/route';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function identity(req:NextRequest){if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};if(!await fitnessAccess(user.id,user.role))return {error:reply({error:'FITNESS_SUBSCRIPTION_REQUIRED'},402)};return {user};}
export async function GET(req:NextRequest){const auth=await identity(req);if(auth.error)return auth.error;const trainers=await prisma.fitnessTrainer.findMany({where:{type:'AI',status:'ACTIVE'},select:{id:true,name:true},take:20});return reply({trainers,maxCredits:FIT_COACH_MAX_CREDITS,personalCredits:await getAvailableCredits(auth.user!.id,prisma,'PERSONAL'),profileReady:!!await prisma.fitnessProfile.findUnique({where:{userId:auth.user!.id},select:{userId:true}}),available:trainers.length>0&&getEnabledProviders().some(p=>p.creditCost<=FIT_COACH_MAX_CREDITS)});}
export async function POST(req:NextRequest){
 const auth=await identity(req);if(auth.error)return auth.error;const user=auth.user!;
 let body:{trainerId:string;message:string;language:'fa'|'en'|'tr';consent:true;acceptedMaxCredits:number;requestKey:string};try{body=z.object({trainerId:z.string().min(1).max(100),message:z.string().trim().min(1).max(3000),language:z.enum(['fa','en','tr']),consent:z.literal(true),acceptedMaxCredits:z.number().int().nonnegative(),requestKey:z.string().regex(/^fit_coach_[a-zA-Z0-9_-]{8,100}$/)}).strict().parse(await req.json());}catch{return reply({error:'Invalid request or missing consent'},400);}
 if(body.acceptedMaxCredits<FIT_COACH_MAX_CREDITS)return reply({error:'Updated cost requires consent',maxCredits:FIT_COACH_MAX_CREDITS},409);
 const hash=createHash('sha256').update(JSON.stringify({trainerId:body.trainerId,message:body.message,language:body.language,acceptedMaxCredits:body.acceptedMaxCredits})).digest('hex');const previous=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:body.requestKey}}});if(previous)return previous.inputHash===hash&&previous.status==='COMPLETED'&&previous.responseJson?reply(JSON.parse(previous.responseJson)):reply({error:'Already submitted; inspect request status',status:previous.status},409);
 let id:string;try{id=(await prisma.mobileRequest.create({data:{userId:user.id,requestKey:body.requestKey,inputHash:hash,status:'RUNNING'}})).id;}catch{return reply({error:'Already submitted'},409);}
 try{const response=await coach(new NextRequest(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({trainerId:body.trainerId,message:body.message,language:body.language})}));const result=await response.json();await prisma.mobileRequest.update({where:{id},data:{status:response.ok?'COMPLETED':'FAILED',responseJson:response.ok?JSON.stringify(result):null}});return reply(result,response.status);}catch{await prisma.mobileRequest.updateMany({where:{id,status:'RUNNING'},data:{status:'UNKNOWN'}});return reply({error:'Coach outcome uncertain; inspect request status'},503);}
}
