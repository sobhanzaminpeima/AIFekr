import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {studentAiHash,studentAiQuote} from '@/lib/student/mobileAiContract';
import {POST as generate} from '@/app/api/student/ai/route';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const input=z.object({courseId:z.string().min(1).max(100),action:z.enum(['ask','flashcards','quiz']),prompt:z.string().trim().min(1).max(4000),count:z.number().int().min(3).max(15).default(8),timeLimitSeconds:z.number().int().min(60).max(7200).optional(),requestKey:z.string().regex(/^student_ai_[a-zA-Z0-9_-]{8,100}$/),acceptedMaxCredits:z.number().int().nonnegative()}).strict();
async function auth(req:NextRequest){if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};const denied=await studentWorkspaceDisabledResponse(user);return denied?{error:denied}:{user};}
export async function GET(req:NextRequest){const identity=await auth(req);if(identity.error)return identity.error;return reply(await studentAiQuote());}
export async function POST(req:NextRequest){
 const identity=await auth(req);if(identity.error)return identity.error;const user=identity.user!;
 let body:z.infer<typeof input>;try{body=input.parse(await req.json());}catch{return reply({error:'Invalid request'},400);}
 if(!await prisma.studentCourse.findFirst({where:{id:body.courseId,userId:user.id},select:{id:true}}))return reply({error:'Course not found'},404);
 const hash=studentAiHash({...body,maxCredits:body.acceptedMaxCredits});
 const prior=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:body.requestKey}}});
 if(prior){if(prior.inputHash!==hash)return reply({error:'Request key already used'},409);return prior.status==='COMPLETED'&&prior.responseJson?reply(JSON.parse(prior.responseJson)):reply({error:'Already submitted; inspect course records before retrying',status:prior.status},409);}
 const quote=await studentAiQuote();if(!quote.available)return reply({error:'AI provider not configured'},503);if(quote.maxCredits>body.acceptedMaxCredits)return reply({error:'Updated cost requires new consent',maxCredits:quote.maxCredits},409);
 let claim:string;try{claim=(await prisma.mobileRequest.create({data:{userId:user.id,requestKey:body.requestKey,inputHash:hash,status:'RUNNING'}})).id;}catch{return reply({error:'Already submitted'},409);}
 try{const response=await generate(new NextRequest(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({courseId:body.courseId,action:body.action,prompt:body.prompt,count:body.count,timeLimitSeconds:body.timeLimitSeconds,nativeRequestId:claim,nativeMaxCredits:body.acceptedMaxCredits})}));const result=await response.json();await prisma.mobileRequest.update({where:{id:claim},data:{status:response.ok?'COMPLETED':'FAILED',responseJson:response.ok?JSON.stringify(result):null}});return reply(result,response.status);}catch{await prisma.mobileRequest.updateMany({where:{id:claim,status:'RUNNING'},data:{status:'UNKNOWN'}});return reply({error:'Outcome uncertain; inspect course records'},503);}
}
