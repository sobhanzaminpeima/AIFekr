import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {proposeStudySessions} from '@/lib/student/planner';
export const dynamic='force-dynamic';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const examVersion=(row:{title:string;examAt:Date})=>hash({title:row.title,examAt:row.examAt.toISOString()});
const taskVersion=(row:{updatedAt:Date})=>row.updatedAt.toISOString();
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
class PlannerError extends Error{constructor(public status:number,message:string){super(message);}}
async function identity(req:NextRequest){if(process.env.MOBILE_API_ENABLED!=='true')return {error:reply({error:'Mobile API disabled'},503)};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};const error=await studentWorkspaceDisabledResponse(user);return error?{error}:{user};}
const id=z.string().min(1).max(100),title=z.string().trim().min(1).max(200),date=z.string().datetime({offset:true});
const base=z.object({courseId:id,requestKey:z.string().regex(/^planner_[a-zA-Z0-9_-]{8,100}$/)});
const taskFields={title,description:z.string().max(4000).default(''),dueAt:date.nullable(),priority:z.number().int().min(1).max(3),taskType:z.enum(['study','assignment'])};
const input=z.discriminatedUnion('action',[
 base.extend({action:z.literal('exam.create'),title,examAt:date}).strict(),
 base.extend({action:z.literal('exam.update'),id,title,examAt:date,version:z.string().length(64)}).strict(),
 base.extend({action:z.literal('exam.delete'),id,version:z.string().length(64)}).strict(),
 base.extend({action:z.literal('plan.generate'),examId:id,version:z.string().length(64)}).strict(),
 base.extend({action:z.literal('task.create'),...taskFields}).strict(),
 base.extend({action:z.literal('task.update'),id,version:date,...taskFields,completed:z.boolean()}).strict(),
 base.extend({action:z.literal('task.delete'),id,version:date}).strict()
]);
export async function GET(req:NextRequest){const auth=await identity(req);if(auth.error)return auth.error;const courseId=req.nextUrl.searchParams.get('courseId');if(!courseId)return reply({error:'Course required'},400);if(!await prisma.studentCourse.findFirst({where:{id:courseId,userId:auth.user!.id},select:{id:true}}))return reply({error:'Course not found'},404);
 const [exams,tasks]=await Promise.all([prisma.studentExam.findMany({where:{userId:auth.user!.id,courseId},orderBy:{examAt:'asc'},take:100}),prisma.studentTask.findMany({where:{userId:auth.user!.id,courseId},orderBy:[{dueAt:'asc'},{createdAt:'desc'}],take:100})]);return reply({exams:exams.map(row=>({...row,version:examVersion(row)})),tasks:tasks.map(row=>({...row,version:taskVersion(row)})),limit:100});}
export async function POST(req:NextRequest){
 const auth=await identity(req);if(auth.error)return auth.error;const userId=auth.user!.id;
 let body:z.infer<typeof input>;try{body=input.parse(await req.json());}catch{return reply({error:'Invalid planner request'},400);}
 const inputHash=hash(body);try{return await prisma.$transaction(async tx=>{
  if(!await tx.studentCourse.findFirst({where:{id:body.courseId,userId},select:{id:true}}))throw new PlannerError(404,'Course not found');
  const prior=await tx.mobileRequest.findUnique({where:{userId_requestKey:{userId,requestKey:body.requestKey}}});
  if(prior){if(prior.inputHash!==inputHash)throw new PlannerError(409,'Request key has different input');return reply(JSON.parse(prior.responseJson||'{}'));}
  let result:unknown;
  if(body.action==='exam.create')result={exam:await tx.studentExam.create({data:{userId,courseId:body.courseId,title:body.title,examAt:new Date(body.examAt)}})};
  else if(body.action==='exam.update'||body.action==='exam.delete'){
   const row=await tx.studentExam.findFirst({where:{id:body.id,userId,courseId:body.courseId}});if(!row)throw new PlannerError(404,'Exam not found');if(examVersion(row)!==body.version)throw new PlannerError(409,'Exam changed; refresh before editing');
   const where={id:row.id,userId,title:row.title,examAt:row.examAt};
   const changed=body.action==='exam.delete'?await tx.studentExam.deleteMany({where}):await tx.studentExam.updateMany({where,data:{title:body.title,examAt:new Date(body.examAt)}});if(!changed.count)throw new PlannerError(409,'Exam changed');result={ok:true};
  }else if(body.action==='plan.generate'){
   const exam=await tx.studentExam.findFirst({where:{id:body.examId,userId,courseId:body.courseId,examAt:{gt:new Date()}},include:{course:{select:{name:true}}}});if(!exam)throw new PlannerError(404,'Future exam not found');const language=req.cookies.get('lang')?.value;const lang=language==='en'||language==='tr'?language:'fa';
   if(examVersion(exam)!==body.version)throw new PlannerError(409,'Exam changed; refresh before planning');
   const proposals=proposeStudySessions([{id:exam.id,title:exam.title,courseId:exam.courseId,courseName:exam.course.name,examAt:exam.examAt}],new Date(),7,lang);let created=0;
   for(const session of proposals){const dedupeKey=`${userId}:${exam.id}:${exam.courseId}:${session.dueAt.toISOString().slice(0,10)}`;if(await tx.studentTask.findUnique({where:{dedupeKey},select:{id:true}}))continue;await tx.studentTask.create({data:{userId,courseId:session.courseId,title:session.title,description:session.description,taskType:'study',dueAt:session.dueAt,generated:true,dedupeKey}});created++;}result={created};
  }else if(body.action==='task.create')result={task:await tx.studentTask.create({data:{userId,courseId:body.courseId,title:body.title,description:body.description,dueAt:body.dueAt?new Date(body.dueAt):null,priority:body.priority,taskType:body.taskType}})};
  else{
   const row=await tx.studentTask.findFirst({where:{id:body.id,userId,courseId:body.courseId}});if(!row)throw new PlannerError(404,'Task not found');if(taskVersion(row)!==body.version)throw new PlannerError(409,'Task changed; refresh before editing');
   const where={id:row.id,userId,updatedAt:row.updatedAt};const changed=body.action==='task.delete'?await tx.studentTask.deleteMany({where}):await tx.studentTask.updateMany({where,data:{title:body.title,description:body.description,dueAt:body.dueAt?new Date(body.dueAt):null,priority:body.priority,taskType:body.taskType,completedAt:body.completed?(row.completedAt||new Date()):null,updatedAt:new Date(Math.max(Date.now(),row.updatedAt.getTime()+1))}});if(!changed.count)throw new PlannerError(409,'Task changed');result={ok:true};
  }
  await tx.mobileRequest.create({data:{userId,requestKey:body.requestKey,inputHash,status:'COMPLETED',responseJson:JSON.stringify(result)}});return reply(result);
 });}catch(error){if(error instanceof PlannerError)return reply({error:error.message},error.status);return reply({error:'Planner save not confirmed; retry the same request key'},503);}
}
