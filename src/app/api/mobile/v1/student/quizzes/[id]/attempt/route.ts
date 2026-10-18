import {createHash} from 'node:crypto';
import {sign} from 'jsonwebtoken';
import {z} from 'zod';
import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {POST as gradeQuiz} from '@/app/api/student/quizzes/[id]/route';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
const questionSchema=z.array(z.object({question:z.string(),options:z.array(z.string()).min(2).max(4)})).min(1).max(100);
const bodySchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('start')}).strict(),
 z.object({action:z.literal('submit'),requestKey:z.string().regex(/^quiz_[a-zA-Z0-9_-]{8,100}$/),answers:z.array(z.number().int().min(0).max(3).nullable()).max(100)}).strict(),
]);
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 if(process.env.MOBILE_API_ENABLED!=='true')return reply({error:'Mobile API disabled'},503);
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`native-quiz:${user.id}`,60,60000).allowed)return reply({error:'Too many requests'},429);
 const denied=await studentWorkspaceDisabledResponse(user);if(denied)return denied;
 const quiz=await prisma.studentQuiz.findFirst({where:{id:params.id,course:{userId:user.id}}});if(!quiz)return reply({error:'Quiz not found'},404);
 let body:z.infer<typeof bodySchema>;let questions:z.infer<typeof questionSchema>;
 try{body=bodySchema.parse(await req.json());questions=questionSchema.parse(JSON.parse(quiz.questions));}catch{return reply({error:'Invalid quiz or request'},400);}
 const startKey=`quiz_start_${quiz.id}`;
 const startRow=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:startKey}}});
 if(body.action==='start'){
  if(quiz.timeLimitSeconds&&await prisma.studentQuizAttempt.findFirst({where:{userId:user.id,quizId:quiz.id},select:{id:true}}))return reply({error:'Quiz already submitted'},409);
  if(startRow?.responseJson){const saved=JSON.parse(startRow.responseJson);if(saved.expiresAt&&Date.parse(saved.expiresAt)<=Date.now())return reply({error:'Quiz time expired'},410);return reply({...saved,serverNow:new Date().toISOString()});}
  const startedAt=new Date();const payload={quiz:{id:quiz.id,title:quiz.title,questions},expiresAt:quiz.timeLimitSeconds?new Date(startedAt.getTime()+quiz.timeLimitSeconds*1000).toISOString():null,attemptToken:quiz.timeLimitSeconds?sign({kind:'student_quiz',quizId:quiz.id,userId:user.id},process.env.JWT_SECRET!,{algorithm:'HS256',expiresIn:quiz.timeLimitSeconds+3600}):null};
  if(quiz.timeLimitSeconds){try{await prisma.mobileRequest.create({data:{userId:user.id,requestKey:startKey,inputHash:createHash('sha256').update(quiz.questions).digest('hex'),status:'COMPLETED',responseJson:JSON.stringify(payload)}});}catch{const raced=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:startKey}}});return raced?.responseJson?reply({...JSON.parse(raced.responseJson),serverNow:new Date().toISOString()}):reply({error:'Start unavailable'},409);}}
  return reply({...payload,serverNow:startedAt.toISOString()});
 }
 if(body.answers.length!==questions.length||body.answers.some((answer,index)=>answer!==null&&answer>=questions[index].options.length))return reply({error:'Invalid answers'},400);
 const key=quiz.timeLimitSeconds?`quiz_submit_${quiz.id}`:body.requestKey;
 const hash=createHash('sha256').update(JSON.stringify({quizId:quiz.id,answers:body.answers})).digest('hex');
 const previous=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:key}}});
 if(previous){
  if(previous.inputHash!==hash)return reply({error:'Answers differ from submitted request'},409);
  if(previous.status==='COMPLETED'&&previous.responseJson)return reply(JSON.parse(previous.responseJson));
  const token=quiz.timeLimitSeconds?(startRow?.responseJson?JSON.parse(startRow.responseJson).attemptToken:null):`native_quiz:${previous.id}`;
  if(token){
   const completed=await prisma.studentQuizAttempt.findFirst({where:{userId:user.id,quizId:quiz.id,attemptToken:token},select:{id:true,score:true,total:true,answers:true}});
   if(completed){
    if(completed.answers!==JSON.stringify(body.answers))return reply({error:'A different answer set was submitted; inspect attempt history'},409);
    const result={attempt:{id:completed.id,score:completed.score,total:completed.total}};
    await prisma.mobileRequest.updateMany({where:{id:previous.id,status:{in:['RUNNING','UNKNOWN']}},data:{status:'COMPLETED',responseJson:JSON.stringify(result)}});
    return reply(result);
   }
  }
  return reply({error:'Already submitted; inspect attempt history',status:previous.status},409);
 }
 const started=startRow?.responseJson?JSON.parse(startRow.responseJson):null;
 if(quiz.timeLimitSeconds&&startRow&&startRow.inputHash!==createHash('sha256').update(quiz.questions).digest('hex'))return reply({error:'Quiz changed after start'},409);
 if(quiz.timeLimitSeconds&&(!started||Date.parse(started.expiresAt)<=Date.now()))return reply({error:'Quiz start missing or time expired'},410);
 let claim:string;try{claim=(await prisma.mobileRequest.create({data:{userId:user.id,requestKey:key,inputHash:hash,status:'RUNNING'}})).id;}catch{return reply({error:'Already submitted'},409);}
 try{
  const response=await gradeQuiz(new NextRequest(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({answers:body.answers,attemptToken:started?.attemptToken,nativeRequestId:claim})}),{params});
  const result=await response.json();await prisma.mobileRequest.update({where:{id:claim},data:{status:response.ok?'COMPLETED':'FAILED',responseJson:response.ok?JSON.stringify(result):null}});return reply(result,response.status);
 }catch{await prisma.mobileRequest.updateMany({where:{id:claim,status:'RUNNING'},data:{status:'UNKNOWN'}});return reply({error:'Outcome uncertain; inspect attempt history'},503);}
}
