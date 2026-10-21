import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {rateLimit} from '@/lib/utils/rateLimit';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const dynamic='force-dynamic';
async function context(req:NextRequest,id:string){
 if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};
 const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};
 if(!rateLimit(`native-quiz-draft:${user.id}`,60,60000).allowed)return {error:reply({error:'Too many requests'},429)};
 const denied=await studentWorkspaceDisabledResponse(user);if(denied)return {error:denied};
 const quiz=await prisma.studentQuiz.findFirst({where:{id,course:{userId:user.id}}});if(!quiz)return {error:reply({error:'Quiz not found'},404)};
 return {user,quiz,key:`quiz_draft_${id}`,hash:createHash('sha256').update(quiz.questions).digest('hex')};
}
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const ctx=await context(req,params.id);if(ctx.error)return ctx.error;
 const row=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:ctx.user!.id,requestKey:ctx.key!}}});
 if(row&&row.inputHash!==ctx.hash)return reply({error:'Quiz changed; saved answers require review'},409);
 return reply({draft:row?.responseJson?JSON.parse(row.responseJson):null,quizHash:ctx.hash});
}
export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 const ctx=await context(req,params.id);if(ctx.error)return ctx.error;
 const user=ctx.user!,quiz=ctx.quiz!,key=ctx.key!,hash=ctx.hash!;
 let body:{revision:number;answers:(number|null)[]};let questions:{options:string[]}[];
 try{body=z.object({revision:z.number().int().nonnegative(),answers:z.array(z.number().int().min(0).max(3).nullable()).min(1).max(100)}).strict().parse(await req.json());questions=z.array(z.object({options:z.array(z.string()).min(2).max(4)})).min(1).max(100).parse(JSON.parse(quiz.questions));}catch{return reply({error:'Invalid draft'},400);}
 if(body.answers.length!==questions.length||body.answers.some((answer,index)=>answer!==null&&answer>=questions[index].options.length))return reply({error:'Invalid answers'},400);
 if(quiz.timeLimitSeconds){const start=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:`quiz_start_${quiz.id}`}}});const expiresAt=start?.responseJson?JSON.parse(start.responseJson).expiresAt:null;if(!expiresAt||Date.parse(expiresAt)<=Date.now())return reply({error:'Quiz time expired or not started'},410);if(await prisma.studentQuizAttempt.findFirst({where:{userId:user.id,quizId:quiz.id},select:{id:true}}))return reply({error:'Quiz already submitted'},409);}
 const existing=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:key}}});
 const revision=existing?.responseJson?JSON.parse(existing.responseJson).revision:0;
 if(existing&&existing.inputHash!==hash||revision!==body.revision)return reply({error:'Draft changed on another device; reload before saving'},409);
 const draft={answers:body.answers,revision:revision+1};
 try{if(existing){const changed=await prisma.mobileRequest.updateMany({where:{id:existing.id,responseJson:existing.responseJson},data:{responseJson:JSON.stringify(draft)}});if(!changed.count)return reply({error:'Draft changed on another device; reload'},409);}else await prisma.mobileRequest.create({data:{userId:user.id,requestKey:key,inputHash:hash,status:'COMPLETED',responseJson:JSON.stringify(draft)}});}catch{return reply({error:'Draft changed or could not be saved; reload'},409);}
 return reply({draft,quizHash:hash});
}
