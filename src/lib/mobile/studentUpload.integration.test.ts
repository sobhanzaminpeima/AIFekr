import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
const state=vi.hoisted(()=>({url:'',actor:'student-native',calls:0,ai:vi.fn(),ocr:vi.fn()}));
vi.mock('@/lib/ai/providers',()=>({PROVIDERS:[{id:'openai-direct',name:'Fixture vision',model:'fixture',apiKey:'fixture-not-a-real-secret',creditCost:3}]}));
vi.mock('@/lib/student/ocr',()=>({ocrImages:state.ocr,extractPptxImages:async()=>[]}));
vi.mock('@/lib/ai/router',()=>({getEnabledProviders:()=>[{id:'fixture-ai',creditCost:3}],routedStreamChat:state.ai}));
vi.mock('@/lib/i18n/server',()=>({getServerLang:async()=> 'en'}));
vi.mock('@/lib/db/prisma',async()=>{const {mkdtempSync,writeFileSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{PrismaClient}=await import('@prisma/client');const path=join(mkdtempSync(join(tmpdir(),'aifekr-study-upload-')),'fixture.db');writeFileSync(path,'');state.url=`file:${path.replaceAll('\\','/')}`;return {prisma:new PrismaClient({datasources:{db:{url:state.url}}})};});
vi.mock('@/lib/auth/middleware',()=>({requireAuth:async()=>({id:state.actor}),unauthorizedResponse:()=>NextResponse.json({error:'Unauthorized'},{status:401})}));
// Extraction is separately covered by the existing parser tests. This fixture
// exercises ownership, the native durable ledger and dispatch exactly once.
vi.mock('@/app/api/student/materials/route',()=>({POST:async(req:NextRequest)=>{state.calls++;const form=await req.formData();const {prisma}=await import('@/lib/db/prisma');const file=form.get('file');const material=await prisma.studentMaterial.create({data:{userId:state.actor,courseId:String(form.get('courseId')),title:file instanceof File?file.name:String(form.get('title')),content:file instanceof File?'Extracted fixture':String(form.get('content')),source:String(form.get('source')||'file')}});return NextResponse.json({material:{id:material.id,title:material.title}},{status:201});}}));
import {prisma} from '@/lib/db/prisma';
import {POST} from '@/app/api/mobile/v1/student/materials/route';
import {GET as quizCatalog} from '@/app/api/mobile/v1/student/quizzes/route';
import {POST as quizAttempt} from '@/app/api/mobile/v1/student/quizzes/[id]/attempt/route';
import {GET as readDraft,POST as saveDraft} from '@/app/api/mobile/v1/student/quizzes/[id]/draft/route';
import {POST as legacyGrade} from '@/app/api/student/quizzes/[id]/route';
import {GET as listGroups,POST as createGroup} from '@/app/api/student/groups/route';
import {GET as readMessages,POST as sendMessage} from '@/app/api/student/groups/[id]/messages/route';
import {POST as joinGroup} from '@/app/api/student/groups/join/route';
import {POST as manageGroup} from '@/app/api/mobile/v1/student/groups/[id]/manage/route';
import {POST as studyAi} from '@/app/api/mobile/v1/student/ai/route';
import {mobileOcr} from '@/lib/mobile/ocr';
import {GET as diaryList,POST as diarySave} from '@/app/api/mobile/v1/fitness/diary/route';
import {POST as coachAsk} from '@/app/api/mobile/v1/fitness/coach/route';
import {GET as fitRequestStatus} from '@/app/api/mobile/v1/fitness/requests/[key]/route';
import {GET as plannerRead,POST as plannerSave} from '@/app/api/mobile/v1/student/planner/route';
let courseId='';
beforeAll(()=>{const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:state.url},encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);},60000);
beforeEach(async()=>{await prisma.mobileRequest.deleteMany();await prisma.studentMaterial.deleteMany();await prisma.studentCourse.deleteMany();await prisma.user.deleteMany();for(const id of ['student-native','student-other'])await prisma.user.create({data:{id,email:`${id}@example.test`,accountType:'STUDENT',plan:'STUDENT_MONTHLY',planExpiry:new Date(Date.now()+86400000)}});courseId=(await prisma.studentCourse.create({data:{userId:'student-native',name:'Course'}})).id;state.actor='student-native';state.calls=0;vi.stubEnv('MOBILE_API_ENABLED','true');});
afterAll(()=>prisma.$disconnect());
const attemptRequest=(id:string,body:unknown)=>new NextRequest(`https://example.test/api/mobile/v1/student/quizzes/${id}/attempt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const createQuiz=(timed=true)=>prisma.studentQuiz.create({data:{courseId,title:'Exam',timeLimitSeconds:timed?300:null,questions:JSON.stringify([{question:'Choose B',topic:'Fixture',explanation:'B is correct',options:['A','B'],correctIndex:1}])}});
describe('native planner atomic writes and web conflicts',()=>{
 const save=(value:unknown)=>plannerSave(new NextRequest('https://example.test/api/mobile/v1/student/planner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}));
 const read=async()=>await (await plannerRead(new NextRequest('https://example.test/api/mobile/v1/student/planner?courseId='+courseId))).json();
 it('creates an exam once and generates the existing editable plan without duplicate sessions',async()=>{
  const body={action:'exam.create',courseId,title:'Planner fixture',examAt:new Date(Date.now()+10*86400000).toISOString(),requestKey:'planner_exam_fixture123456'};
  expect((await save(body)).status).toBe(200);expect((await save(body)).status).toBe(200);expect(await prisma.studentExam.count()).toBe(1);
  const exam=(await read()).exams[0],plan={action:'plan.generate',courseId,examId:exam.id,version:exam.version,requestKey:'planner_plan_fixture123456'};
  expect((await save(plan)).status).toBe(200);const count=await prisma.studentTask.count();expect(count).toBeGreaterThan(0);expect((await save(plan)).status).toBe(200);expect((await save({...plan,requestKey:'planner_plan_again123456'})).status).toBe(200);expect(await prisma.studentTask.count()).toBe(count);
 });
 it('refuses foreign courses and stale web edits without saving a ledger result',async()=>{
  const exam=await prisma.studentExam.create({data:{userId:state.actor,courseId,title:'Before',examAt:new Date(Date.now()+86400000)}}),old=(await read()).exams[0];
  await prisma.studentExam.update({where:{id:exam.id},data:{title:'Web changed'}});
  expect((await save({action:'exam.update',courseId,id:exam.id,title:'Native stale',examAt:old.examAt,version:old.version,requestKey:'planner_stale_fixture123456'})).status).toBe(409);expect(await prisma.mobileRequest.count()).toBe(0);
  state.actor='student-other';expect((await plannerRead(new NextRequest('https://example.test/api/mobile/v1/student/planner?courseId='+courseId))).status).toBe(404);
 });
 it('updates a task with a new revision, rejects stale overwrites and replays its deletion',async()=>{
  const value={courseId,title:'Study fixture',description:'Fixture',dueAt:null,priority:3,taskType:'study'};
  expect((await save({...value,action:'task.create',requestKey:'planner_task_fixture123456'})).status).toBe(200);const original=(await read()).tasks[0];
  const edit={...value,action:'task.update',id:original.id,version:original.version,completed:true,requestKey:'planner_task_edit123456'};expect((await save(edit)).status).toBe(200);const updated=(await read()).tasks[0];expect(updated.completedAt).not.toBeNull();expect(updated.version).not.toBe(original.version);
  expect((await save({...edit,title:'Stale',requestKey:'planner_task_stale123456'})).status).toBe(409);
  const remove={action:'task.delete',courseId,id:updated.id,version:updated.version,requestKey:'planner_task_delete123456'};expect((await save(remove)).status).toBe(200);expect((await save(remove)).status).toBe(200);expect(await prisma.studentTask.count()).toBe(0);
 });
});
describe('native FIT coach consent, cost and replay',()=>{
 it('charges the personal wallet once and refuses missing consent or a changed retry',async()=>{
  state.ai.mockReset();state.ai.mockImplementation(async(_messages:unknown,_system:string,chunk:(text:string)=>void,selected:(provider:unknown)=>void)=>{const provider={id:'fixture-ai',model:'fixture',creditCost:3};selected(provider);chunk('Synthetic general education only');return provider;});
  const trainer=await prisma.fitnessTrainer.upsert({where:{slug:'native-coach-fixture'},create:{slug:'native-coach-fixture',name:'Fixture AI',type:'AI',status:'ACTIVE',biography:'Synthetic',image:''},update:{}});
  const body={trainerId:trainer.id,message:'General exercise education',language:'en',consent:true,acceptedMaxCredits:5,requestKey:'fit_coach_fixture123456'};
  const ask=(value:unknown)=>coachAsk(new NextRequest('https://example.test/api/mobile/v1/fitness/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}));
  expect((await ask(body)).status).toBe(402);
  await prisma.user.update({where:{id:state.actor},data:{credits:100,fitnessAccessExpiry:new Date(Date.now()+86400000)}});
  await prisma.fitnessProfile.create({data:{userId:state.actor,age:30,goal:'Fixture education',consentAt:new Date()}});
  expect((await ask({...body,consent:false})).status).toBe(400);
  expect((await ask({...body,acceptedMaxCredits:0})).status).toBe(409);
  expect((await ask(body)).status).toBe(200);expect((await ask(body)).status).toBe(200);
  expect((await ask({...body,message:'Changed request'})).status).toBe(409);
  expect(state.ai).toHaveBeenCalledTimes(1);expect((await prisma.user.findUnique({where:{id:state.actor}}))?.credits).toBe(97);
  const statusRequest=new NextRequest('https://example.test/api/mobile/v1/fitness/requests/'+body.requestKey);
  expect((await fitRequestStatus(statusRequest,{params:Promise.resolve({key:body.requestKey})})).status).toBe(200);
  expect((await fitRequestStatus(statusRequest,{params:Promise.resolve({key:'student_ai_private123456'})})).status).toBe(404);
  state.actor='student-other';expect((await fitRequestStatus(statusRequest,{params:Promise.resolve({key:body.requestKey})})).status).toBe(404);
 });
});
describe('native FIT journal consent and independent entitlement',()=>{
 it('requires active FIT entitlement and explicit consent, saves once and keeps entries private',async()=>{
  const body={kind:'MEAL',content:'Synthetic meal note',day:new Date().toISOString(),requestKey:'fit_diary_fixture123456',consent:true};
  const req=(value:unknown)=>new NextRequest('https://example.test/api/mobile/v1/fitness/diary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  expect((await diarySave(req(body))).status).toBe(402);
  await prisma.user.update({where:{id:state.actor},data:{fitnessAccessExpiry:new Date(Date.now()+86400000)}});
  expect((await diarySave(req({...body,consent:false}))).status).toBe(400);
  expect((await diarySave(req(body))).status).toBe(201);expect((await diarySave(req(body))).status).toBe(200);expect(await prisma.fitnessDiary.count()).toBe(1);
  state.actor='student-other';await prisma.user.update({where:{id:state.actor},data:{fitnessAccessExpiry:new Date(Date.now()+86400000)}});expect((await (await diaryList(new NextRequest('https://example.test/api/mobile/v1/fitness/diary'))).json()).diary).toEqual([]);
 });
});
describe('native OCR reservations and reviewed material storage',()=>{
 beforeEach(async()=>{state.ocr.mockReset();state.ocr.mockResolvedValue('Synthetic recognized text');await prisma.user.update({where:{id:state.actor},data:{credits:100}});});
 const file=()=>new File(['fixture-image'],'notes.png',{type:'image/png'});
 it('extracts once and replays without another credit charge',async()=>{expect((await mobileOcr(state.actor,file(),'student_ocr_fixture123456',100,'en')).status).toBe(200);expect((await mobileOcr(state.actor,file(),'student_ocr_fixture123456',100,'en')).status).toBe(200);expect(state.ocr).toHaveBeenCalledTimes(1);expect((await prisma.user.findUnique({where:{id:state.actor}}))?.credits).toBe(98);});
 it('refunds a confirmed failure once and refuses an automatic rerun',async()=>{state.ocr.mockRejectedValue(Error('Fixture OCR failure'));expect((await mobileOcr(state.actor,file(),'student_ocr_failure123456',100,'en')).status).toBe(502);expect((await mobileOcr(state.actor,file(),'student_ocr_failure123456',100,'en')).status).toBe(409);expect(state.ocr).toHaveBeenCalledTimes(1);expect((await prisma.user.findUnique({where:{id:state.actor}}))?.credits).toBe(100);});
 it('saves reviewed OCR text as a material only once',async()=>{const upload=()=>{const form=new FormData();form.set('courseId',courseId);form.set('requestKey','material_ocr_review_fixture');form.set('title','Reviewed notes');form.set('content','User-reviewed OCR text');form.set('source','image_ocr');return POST(new NextRequest('https://example.test/api/mobile/v1/student/materials',{method:'POST',body:form}));};expect((await upload()).status).toBe(201);expect((await upload()).status).toBe(200);expect(await prisma.studentMaterial.count()).toBe(1);expect((await prisma.studentMaterial.findFirst())?.content).toBe('User-reviewed OCR text');});
});
describe('native study generation cost consent and durable admission',()=>{
 beforeEach(async()=>{state.ai.mockReset();await prisma.user.update({where:{id:state.actor},data:{credits:1000}});await prisma.studentMaterial.create({data:{courseId,userId:state.actor,title:'Source',content:'Synthetic course material.',source:'text'}});vi.stubEnv('JWT_SECRET','isolated-study-fixture-key');state.ai.mockImplementation(async(_messages:unknown,_system:string,chunk:(text:string)=>void,selected:(provider:unknown)=>void)=>{const provider={id:'fixture-ai',name:'Fixture',model:'fixture-model',creditCost:3};selected(provider);chunk(JSON.stringify(Array.from({length:3},()=>({question:'Q',topic:'Fixture',explanation:'A',options:['A','B','C','D'],correctIndex:0}))));return provider;});});
 const generate=(courseId:string,acceptedMaxCredits=10000)=>studyAi(new NextRequest('https://example.test/api/mobile/v1/student/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseId,action:'quiz',prompt:'Create a source-based quiz',count:3,requestKey:'student_ai_fixture123456',acceptedMaxCredits})}));
 it('uses actual quiz persistence and credit accounting exactly once',async()=>{expect((await generate(courseId)).status).toBe(200);expect((await generate(courseId)).status).toBe(200);expect(state.ai).toHaveBeenCalledTimes(1);expect(await prisma.studentQuiz.count()).toBe(1);expect((await prisma.user.findUnique({where:{id:state.actor}}))?.credits).toBe(997);});
 it('does not execute a provider when cost consent or ownership fails',async()=>{expect((await generate(courseId,0)).status).toBe(409);expect((await generate('foreign-course')).status).toBe(404);expect(state.ai).not.toHaveBeenCalled();});
});
describe('unfinished native quiz answers',()=>{
 it('restores saved answers and refuses stale device revisions',async()=>{const quiz=await createQuiz(false),ctx={params:Promise.resolve({id:quiz.id})};const save=(revision:number,answers:(number|null)[])=>saveDraft(attemptRequest(quiz.id,{revision,answers}),ctx);expect((await save(0,[1])).status).toBe(200);expect((await (await readDraft(attemptRequest(quiz.id,{}),ctx)).json()).draft).toEqual({answers:[1],revision:1});expect((await save(0,[0])).status).toBe(409);expect((await save(1,[null])).status).toBe(200);});
 it('does not expose drafts to another student or restore answers to changed questions',async()=>{const quiz=await createQuiz(false),ctx={params:Promise.resolve({id:quiz.id})};await saveDraft(attemptRequest(quiz.id,{revision:0,answers:[1]}),ctx);state.actor='student-other';expect((await readDraft(attemptRequest(quiz.id,{}),ctx)).status).toBe(404);state.actor='student-native';await prisma.studentQuiz.update({where:{id:quiz.id},data:{questions:quiz.questions.replace('Choose B','Changed')}});expect((await readDraft(attemptRequest(quiz.id,{}),ctx)).status).toBe(409);});
 it('does not save timed answers before the server clock starts',async()=>{const quiz=await createQuiz();expect((await saveDraft(attemptRequest(quiz.id,{revision:0,answers:[null]}),{params:Promise.resolve({id:quiz.id})})).status).toBe(410);expect(await prisma.mobileRequest.count()).toBe(0);});
});
describe('native group backend membership contract',()=>{
 it('transfers ownership only to a member and immediately denies old-owner controls',async()=>{
  const group=await prisma.studentStudyGroup.create({data:{ownerId:state.actor,name:'Transfer fixture',inviteCode:'transfer-fixture-code',members:{create:[{userId:state.actor},{userId:'student-other'}]}}}),ctx={params:Promise.resolve({id:group.id})};
  const request=(body:unknown)=>new NextRequest('https://example.test/api/mobile/v1/student/groups/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  expect((await manageGroup(request({action:'transfer',userId:'outsider',requestKey:'group_manage_bad_transfer'}),ctx)).status).toBe(400);
  expect((await manageGroup(request({action:'transfer',userId:'student-other',requestKey:'group_manage_good_transfer'}),ctx)).status).toBe(200);
  expect((await prisma.studentStudyGroup.findUnique({where:{id:group.id}}))?.ownerId).toBe('student-other');
  expect((await manageGroup(request({action:'rotate',requestKey:'group_manage_old_owner'}),ctx)).status).toBe(403);
  expect((await manageGroup(request({action:'leave',requestKey:'group_manage_former_leave'}),ctx)).status).toBe(200);
  state.actor='student-other';expect((await manageGroup(request({action:'rotate',requestKey:'group_manage_new_owner'}),ctx)).status).toBe(200);
 });
 it('restricts owner controls, revokes old invite codes and replays rotation only once',async()=>{
  const group=await prisma.studentStudyGroup.create({data:{ownerId:state.actor,name:'Managed fixture',inviteCode:'old-fixture-code',members:{create:{userId:state.actor}}}}),ctx={params:Promise.resolve({id:group.id})};
  const request=(body:unknown)=>new NextRequest('https://example.test/api/mobile/v1/student/groups/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const body={action:'rotate',requestKey:'group_manage_fixture123456'};
  const first=await (await manageGroup(request(body),ctx)).json(),second=await (await manageGroup(request(body),ctx)).json();expect(first.inviteCode).toBe(second.inviteCode);expect(first.inviteCode).not.toBe('old-fixture-code');expect(await prisma.auditLog.count({where:{targetId:group.id}})).toBe(1);
  state.actor='student-other';expect((await joinGroup(request({inviteCode:'old-fixture-code'}))).status).toBe(404);await prisma.studentStudyGroupMember.create({data:{groupId:group.id,userId:state.actor}});expect((await manageGroup(request({...body,requestKey:'group_manage_member_fixture'}),ctx)).status).toBe(403);
  expect((await manageGroup(request({action:'leave',requestKey:'group_manage_leave_fixture'}),ctx)).status).toBe(200);expect(await prisma.studentStudyGroupMember.count({where:{groupId:group.id,userId:state.actor}})).toBe(0);
 });
 it('keeps group messages private until the owner-provided invite is accepted',async()=>{
  const json=(path:string,body:unknown)=>new NextRequest(`https://example.test${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const created=await createGroup(json('/api/student/groups',{name:'Fixture study group',courseId}));expect(created.status).toBe(201);const {group}=await created.json();
  const req=new NextRequest('https://example.test/api/student/groups');state.actor='student-other';expect((await (await listGroups(req)).json()).groups).toEqual([]);expect((await readMessages(req,{params:Promise.resolve({id:group.id})})).status).toBe(404);
  expect((await sendMessage(json('/api/student/groups/messages',{content:'Not permitted'}),{params:Promise.resolve({id:group.id})})).status).toBe(404);
  expect((await joinGroup(json('/api/student/groups/join',{inviteCode:group.inviteCode}))).status).toBe(200);
  expect((await sendMessage(json('/api/student/groups/messages',{content:'Synthetic fixture only'}),{params:Promise.resolve({id:group.id})})).status).toBe(201);
  expect((await (await readMessages(req,{params:Promise.resolve({id:group.id})})).json()).messages).toHaveLength(1);
 });
});
describe('native quiz start and durable grading',()=>{
 beforeEach(()=>vi.stubEnv('JWT_SECRET','isolated-fixture-signing-key'));
 it('recovers untimed committed grading through its admitted request identity',async()=>{
  const quiz=await createQuiz(false),key='quiz_untimed_recovery_fixture';
  const claim=await prisma.mobileRequest.create({data:{userId:state.actor,requestKey:key,inputHash:createHash('sha256').update(JSON.stringify({quizId:quiz.id,answers:[1]})).digest('hex'),status:'UNKNOWN'}});
  await prisma.studentQuizAttempt.create({data:{userId:state.actor,quizId:quiz.id,answers:'[1]',score:1,total:1,attemptToken:`native_quiz:${claim.id}`}});
  expect((await quizAttempt(attemptRequest(quiz.id,{action:'submit',requestKey:key,answers:[1]}),{params:Promise.resolve({id:quiz.id})})).status).toBe(200);expect(await prisma.studentQuizAttempt.count()).toBe(1);
 });
 it('rejects forged native request identity while preserving legacy untimed grading',async()=>{
  const quiz=await createQuiz(false),ctx={params:Promise.resolve({id:quiz.id})};
  expect((await legacyGrade(attemptRequest(quiz.id,{answers:[1],nativeRequestId:'unadmitted'}),ctx)).status).toBe(403);
  expect((await legacyGrade(attemptRequest(quiz.id,{answers:[1]}),ctx)).status).toBe(201);
  expect((await legacyGrade(attemptRequest(quiz.id,{answers:[1]}),ctx)).status).toBe(201);
  expect(await prisma.studentQuizAttempt.count()).toBe(2);
 });
 it('recovers a timed grade committed before the request ledger was completed',async()=>{
  const quiz=await createQuiz(),ctx={params:Promise.resolve({id:quiz.id})};
  const started=await (await quizAttempt(attemptRequest(quiz.id,{action:'start'}),ctx)).json();
  await prisma.studentQuizAttempt.create({data:{userId:state.actor,quizId:quiz.id,answers:'[1]',score:1,total:1,attemptToken:started.attemptToken}});
  await prisma.mobileRequest.create({data:{userId:state.actor,requestKey:`quiz_submit_${quiz.id}`,inputHash:createHash('sha256').update(JSON.stringify({quizId:quiz.id,answers:[1]})).digest('hex'),status:'UNKNOWN'}});
  const recovered=await quizAttempt(attemptRequest(quiz.id,{action:'submit',requestKey:'quiz_fixture123456',answers:[1]}),ctx);
  expect(recovered.status).toBe(200);expect((await recovered.json()).attempt.score).toBe(1);expect(await prisma.studentQuizAttempt.count()).toBe(1);
  expect((await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:state.actor,requestKey:`quiz_submit_${quiz.id}`}}}))?.status).toBe('COMPLETED');
 });
 it('resumes the original deadline and hides explanations/answer keys',async()=>{const quiz=await createQuiz();const start=()=>quizAttempt(attemptRequest(quiz.id,{action:'start'}),{params:Promise.resolve({id:quiz.id})});const first=await (await start()).json(),second=await (await start()).json();expect(second.expiresAt).toBe(first.expiresAt);expect(second.attemptToken).toBe(first.attemptToken);expect(first.quiz.questions[0]).toEqual({question:'Choose B',options:['A','B']});});
 it('records a timed attempt once and recovers the same result',async()=>{const quiz=await createQuiz();await quizAttempt(attemptRequest(quiz.id,{action:'start'}),{params:Promise.resolve({id:quiz.id})});const submit=()=>quizAttempt(attemptRequest(quiz.id,{action:'submit',requestKey:'quiz_fixture123456',answers:[1]}),{params:Promise.resolve({id:quiz.id})});expect((await submit()).status).toBe(201);const replay=await submit();expect(replay.status).toBe(200);expect((await replay.json()).attempt.score).toBe(1);expect(await prisma.studentQuizAttempt.count()).toBe(1);});
 it('does not restart or grade an expired timed attempt',async()=>{const quiz=await createQuiz();await quizAttempt(attemptRequest(quiz.id,{action:'start'}),{params:Promise.resolve({id:quiz.id})});const row=(await prisma.mobileRequest.findFirst())!;const payload=JSON.parse(row.responseJson!);payload.expiresAt=new Date(0).toISOString();await prisma.mobileRequest.update({where:{id:row.id},data:{responseJson:JSON.stringify(payload)}});for(const body of [{action:'start'},{action:'submit',requestKey:'quiz_fixture123456',answers:[1]}])expect((await quizAttempt(attemptRequest(quiz.id,body),{params:Promise.resolve({id:quiz.id})})).status).toBe(410);expect(await prisma.studentQuizAttempt.count()).toBe(0);});
 it('rejects grading without start, foreign course and out-of-range option',async()=>{const quiz=await createQuiz();expect((await quizAttempt(attemptRequest(quiz.id,{action:'submit',requestKey:'quiz_fixture123456',answers:[1]}),{params:Promise.resolve({id:quiz.id})})).status).toBe(410);state.actor='student-other';expect((await quizAttempt(attemptRequest(quiz.id,{action:'start'}),{params:Promise.resolve({id:quiz.id})})).status).toBe(404);state.actor='student-native';expect((await quizAttempt(attemptRequest(quiz.id,{action:'submit',requestKey:'quiz_fixture123456',answers:[3]}),{params:Promise.resolve({id:quiz.id})})).status).toBe(400);});
 it('protects untimed retries and rejects changed answers under the same key',async()=>{const quiz=await createQuiz(false);const submit=(answers:number[])=>quizAttempt(attemptRequest(quiz.id,{action:'submit',requestKey:'quiz_fixture123456',answers}),{params:Promise.resolve({id:quiz.id})});expect((await submit([1])).status).toBe(201);expect((await submit([1])).status).toBe(200);expect((await submit([0])).status).toBe(409);expect(await prisma.studentQuizAttempt.count()).toBe(1);});
 it('refuses a timed quiz edited after its clock started',async()=>{const quiz=await createQuiz();await quizAttempt(attemptRequest(quiz.id,{action:'start'}),{params:Promise.resolve({id:quiz.id})});await prisma.studentQuiz.update({where:{id:quiz.id},data:{questions:quiz.questions.replace('Choose B','Changed question')}});expect((await quizAttempt(attemptRequest(quiz.id,{action:'submit',requestKey:'quiz_fixture123456',answers:[1]}),{params:Promise.resolve({id:quiz.id})})).status).toBe(409);});
});
function upload(key='material_fixture123456',bytes='fixture'){const form=new FormData();form.set('courseId',courseId);form.set('requestKey',key);form.set('file',new File([bytes],'notes.pdf',{type:'application/pdf'}));return new NextRequest('https://example.test/api/mobile/v1/student/materials',{method:'POST',body:form});}
describe('durable native study upload',()=>{
 it('dispatches once and recovers the completed result without another extraction',async()=>{expect((await POST(upload())).status).toBe(201);expect((await POST(upload())).status).toBe(200);expect(state.calls).toBe(1);expect(await prisma.studentMaterial.count()).toBe(1);});
 it('rejects an altered file using an already admitted key',async()=>{await POST(upload());expect((await POST(upload('material_fixture123456','different'))).status).toBe(409);expect(state.calls).toBe(1);});
 it('does not admit another student into the course',async()=>{state.actor='student-other';expect((await POST(upload())).status).toBe(404);expect(await prisma.mobileRequest.count()).toBe(0);});
 it('denies expired study entitlement before parsing or writing',async()=>{await prisma.user.update({where:{id:state.actor},data:{planExpiry:new Date(0)}});expect((await POST(upload())).status).toBe(403);expect(state.calls).toBe(0);});
 it('does not dispatch twice under simultaneous submissions',async()=>{const responses=await Promise.all([POST(upload()),POST(upload())]);expect(responses.some(r=>r.status===201)).toBe(true);expect(state.calls).toBe(1);});
 it('lists only owned course quizzes without exposing answer keys',async()=>{
  await prisma.studentQuiz.create({data:{courseId,title:'Fixture quiz',questions:JSON.stringify([{question:'Q',options:['A','B'],correctIndex:1}])}});
  const req=()=>new NextRequest(`https://example.test/api/mobile/v1/student/quizzes?courseId=${courseId}`);
  const response=await quizCatalog(req());expect(response.status).toBe(200);const body=await response.json();expect(body.quizzes).toHaveLength(1);expect(body.quizzes[0].questions).toBeUndefined();state.actor='student-other';expect((await (await quizCatalog(req())).json()).quizzes).toEqual([]);
 });});

