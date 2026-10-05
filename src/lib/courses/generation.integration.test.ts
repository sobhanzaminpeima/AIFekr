import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
const { model } = vi.hoisted(() => ({ model: vi.fn() }));
vi.mock("@/lib/ai/router", () => ({ routedStreamChat: model }));
import { prisma } from "@/lib/db/prisma";
import { generateCourse, reconcileCourseJobs } from "./generation";
import { saveCourseProgress, publishedCourse } from "./learning";
import { publicCourseContent, parseCourseContent } from "./content";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { signToken } from "@/lib/auth/jwt";
import { GET as certificate } from "@/app/api/learn/courses/[id]/certificate/route";
import { PATCH as edit, GET as detail } from "@/app/api/admin/ai-courses/[id]/route";
import { POST as generate } from "@/app/api/admin/ai-courses/[id]/generate/route";
import { GET as catalog } from "@/app/api/learn/courses/route";

export const validCourse = {
  overview: "A practical university course covering fundamentals, applications, testing and a final project.",
  objectives: ["Understand the fundamentals", "Apply concepts in practical projects", "Test and evaluate your work"],
  chapters: Array.from({ length: 3 }, (_,index) => ({ title: `Chapter ${index+1}`, lessons: [{ title: `Lesson ${index+1}`, content: "A complete instructional explanation with a practical worked example. ".repeat(8), activity: "Practice the concepts by completing the worked example independently.", quiz: [{ question: "Which option correctly describes the course principle?", options:["Correct explanation", "Wrong explanation", "Unrelated answer", "Another wrong answer"], correctIndex:0, explanation: "The first option correctly follows the principle taught in the lesson." }] }] })),
  finalProject: { title:"Practical final project", instructions:"Build an original practical project demonstrating the concepts from all chapters, document your decisions and test the result. Explain limitations and improvements.", rubric:["Demonstrates understanding of core concepts", "Uses appropriate testing and documentation", "Explains decisions and limitations clearly"] },
};
describe.runIf(process.env.RUN_BANK_INTEGRATION === "1")("AI course generation uses the existing credit ledger", () => {
  const users: string[] = []; const courses: string[] = []; const teams: string[] = []; const stamp = randomUUID(); let savedCosts: string | null = null;
  async function user(credits = 150, role = "ADMIN") {
    const account = await prisma.user.create({ data:{ email:`course-${randomUUID()}@test.invalid`,role,credits,aiCredits:credits,accountType:"STUDENT",plan:"STUDENT_FIRST_THREE_MONTHS",planExpiry:new Date(Date.now()+86400000) } });users.push(account.id);return account;
  }
  async function course() { const row = await prisma.aiCourse.create({ data:{ creatorId:users[0],title:"React Development",fieldOfStudy:"Computer Science",description:"Create a practical React course with hooks, routing, tests and a final project." } });courses.push(row.id);return row; }
  const input = () => ({ idempotencyKey:randomUUID(),expectedCredits:100 });
  const request = (id: string,body?: unknown) => new NextRequest("https://aifekr.test/api/admin/ai-courses", {method:body?"POST":"GET",headers:{cookie:`token=${signToken({userId:id,role:"ADMIN",plan:"STUDENT_FIRST_THREE_MONTHS"})}`,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
  beforeAll(async () => {
    if(process.env.DATABASE_URL !== "file:./vitest.db") throw new Error("Isolated test database required");
    savedCosts = (await prisma.siteSetting.findUnique({where:{key:"creditCosts"}}))?.value || null;
    await prisma.siteSetting.deleteMany({where:{key:"creditCosts"}});await user();
  });
  beforeEach(() => { model.mockReset();model.mockImplementation(async (_messages,_system,onChunk,onProvider) => {onProvider({id:"test",model:"test-model"});onChunk(JSON.stringify(_system.includes("only the outline") ? {...validCourse,chapters:validCourse.chapters.map(chapter=>({...chapter,lessons:chapter.lessons.map(lesson=>lesson.title)}))} : validCourse.chapters[0].lessons[0]));return {id:"test",model:"test-model"};}); });
  afterAll(async () => {
    await prisma.aiCourseProgress.deleteMany({where:{courseId:{in:courses}}});await prisma.aiCourseGenerationJob.deleteMany({where:{courseId:{in:courses}}});await prisma.aiCourse.deleteMany({where:{id:{in:courses}}});
    await prisma.usageLog.deleteMany({where:{userId:{in:users}}});await prisma.teamMember.deleteMany({where:{teamId:{in:teams}}});await prisma.team.deleteMany({where:{id:{in:teams}}});await prisma.user.deleteMany({where:{id:{in:users}}});
    await prisma.errorLog.deleteMany({where:{source:"ai-course-generation",userId:{in:users}}});
    await prisma.siteSetting.deleteMany({where:{key:"creditCosts"}});if(savedCosts) await prisma.siteSetting.create({data:{key:"creditCosts",value:savedCosts}});
  });
  it("150 → 50 only after valid generation, with existing ledger and review required",async () => {
    const u=await user();const c=await course();const job=await generateCourse(u.id,c.id,input());expect(job.status).toBe("SUCCEEDED");
    expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(50);
    const log=await prisma.usageLog.findUniqueOrThrow({where:{id:job.usageLogId}});expect(log.credits).toBe(100);expect(JSON.parse(log.metadata!)).toMatchObject({action:"AI_COURSE_GENERATION",courseTitle:"React Development",courseId:c.id,generationJobId:job.id,status:"COMMITTED",creditDelta:-100});
    expect((await prisma.aiCourse.findUniqueOrThrow({where:{id:c.id}})).status).toBe("GENERATED");await expect(publishedCourse(c.id)).rejects.toMatchObject({status:404});
  });
  it("99 credits cannot start or partially generate",async () => {const u=await user(99);const c=await course();await expect(generateCourse(u.id,c.id,input())).rejects.toMatchObject({code:"INSUFFICIENT_CREDITS",status:402,required:100});expect(model).not.toHaveBeenCalled();expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(99);expect((await prisma.aiCourse.findUniqueOrThrow({where:{id:c.id}})).content).toBeNull();});
  it.each(["provider","invalid","empty"])("%s failure refunds once and records failure state",async failure => {
    const u=await user();const c=await course();model.mockImplementation(async (_m,_s,onChunk) => {if(failure === "provider")throw new Error("Provider error");onChunk(failure === "empty" ? "" : '{"chapters":[]}');return {id:"test",model:"test"};});
    const req=input();const job=await generateCourse(u.id,c.id,req);expect(job.status).toBe("REFUNDED");await generateCourse(u.id,c.id,req);expect(model).toHaveBeenCalledTimes(1);expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(150);expect((await prisma.usageLog.aggregate({where:{userId:u.id},_sum:{credits:true}}))._sum.credits).toBe(0);
  });
  it("duplicate completed request cannot charge twice",async () => {const u=await user();const c=await course();const req=input();const a=await generateCourse(u.id,c.id,req);const b=await generateCourse(u.id,c.id,req);expect(a.id).toBe(b.id);expect(model).toHaveBeenCalledTimes(4);expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(50);});
  it("duplicate while generating returns same job; crashed/expired lease refunds and fences late results",async () => {
    const u=await user();const c=await course();const req=input();let finish!:()=>void;let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
    let first=true;model.mockImplementation(async (_m,_s,onChunk) => {if(first){first=false;began();await new Promise<void>(resolve=>{finish=resolve;});}onChunk(JSON.stringify(_s.includes("only the outline") ? {...validCourse,chapters:validCourse.chapters.map(chapter=>({...chapter,lessons:chapter.lessons.map(lesson=>lesson.title)}))} : validCourse.chapters[0].lessons[0]));return {id:"test",model:"test"};});
    const pending=generateCourse(u.id,c.id,req);await started;const duplicate=await generateCourse(u.id,c.id,req);expect(duplicate.status).toBe("GENERATING");expect(model).toHaveBeenCalledTimes(1);
    await prisma.aiCourseGenerationJob.update({where:{id:duplicate.id},data:{expiresAt:new Date(0)}});await reconcileCourseJobs();await reconcileCourseJobs();finish();expect((await pending).status).toBe("REFUNDED");expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(150);expect((await prisma.aiCourse.findUniqueOrThrow({where:{id:c.id}})).content).toBeNull();
  });
  it("all normal learning, completion and earned certificate downloads cost zero",async () => {
    const admin=await user();const student=await user(150,"USER");const c=await course();await generateCourse(admin.id,c.id,input());await prisma.aiCourse.update({where:{id:c.id},data:{status:"PUBLISHED"}});
    const published=await publishedCourse(c.id);expect(publicCourseContent(published.content).chapters[0].lessons[0].quiz[0]).not.toHaveProperty("correctIndex");
    for(let index=0;index<3;index++){await saveCourseProgress(student.id,c.id,{lessonId:`${index}:0`,action:"quiz",answers:[0]});await saveCourseProgress(student.id,c.id,{lessonId:`${index}:0`,action:"complete"});}
    await saveCourseProgress(student.id,c.id,{lessonId:"2:0",action:"complete"});await publishedCourse(c.id);
    const download=await certificate(request(student.id),{params:{id:c.id}});expect(download.status).toBe(200);expect(await download.text()).toContain("Certificate of Course Completion");
    expect((await certificate(request(student.id),{params:{id:c.id}})).status).toBe(200);expect((await prisma.user.findUniqueOrThrow({where:{id:student.id}})).credits).toBe(150);expect(await prisma.usageLog.count({where:{userId:student.id}})).toBe(0);
    expect((await certificate(request(admin.id),{params:{id:c.id}})).status).toBe(404);
  });
  it("manual editing costs zero; full regeneration requires explicit confirmation and a new paid job",async () => {
    const u=await user(350);const c=await course();await generateCourse(u.id,c.id,input());
    const saved=await prisma.aiCourse.findUniqueOrThrow({where:{id:c.id}});const edited=await edit(request(u.id,{version:saved.version,content:validCourse}),{params:{id:c.id}});expect(edited.status).toBe(200);expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(250);
    await expect(generateCourse(u.id,c.id,{...input(),regenerate:true})).rejects.toMatchObject({code:"REGENERATION_CONFIRMATION_REQUIRED"});expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(250);
    expect((await generateCourse(u.id,c.id,{...input(),regenerate:true,confirmRegeneration:true})).status).toBe("SUCCEEDED");expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(150);
  });
  it("cost comes from existing Credit Rules and requires the displayed price to match",async () => {
    const u=await user(250);const c=await course();await prisma.siteSetting.upsert({where:{key:"creditCosts"},create:{key:"creditCosts",value:'{"AI_COURSE_GENERATION":120}'},update:{value:'{"AI_COURSE_GENERATION":120}'}});
    expect((await getCreditCosts()).AI_COURSE_GENERATION).toBe(120);await expect(generateCourse(u.id,c.id,input())).rejects.toMatchObject({code:"COST_CHANGED",required:120});expect(model).not.toHaveBeenCalled();await generateCourse(u.id,c.id,{...input(),expectedCredits:120});expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(130);await prisma.siteSetting.deleteMany({where:{key:"creditCosts"}});
  });
  it("refund returns to original team even after membership changes",async () => {
    const owner=await user();const member=await user(15);const team=await prisma.team.create({data:{name:`Course ${stamp}`,ownerId:owner.id,credits:150,aiCredits:60}});teams.push(team.id);await prisma.teamMember.create({data:{teamId:team.id,userId:member.id,role:"MEMBER"}});
    const c=await course();model.mockImplementation(async () => {await prisma.teamMember.delete({where:{userId:member.id}});throw new Error("Failed after member moved");});const job=await generateCourse(member.id,c.id,input());expect(job.status).toBe("REFUNDED");expect((await prisma.team.findUniqueOrThrow({where:{id:team.id}})).credits).toBe(150);expect((await prisma.team.findUniqueOrThrow({where:{id:team.id}})).aiCredits).toBe(60);expect((await prisma.user.findUniqueOrThrow({where:{id:member.id}})).credits).toBe(15);
  });
  it("normal students cannot access the paid generation route",async()=>{const student=await user(150,"USER");const c=await course();expect((await generate(request(student.id,input()),{params:{id:c.id}})).status).toBe(403);expect(model).not.toHaveBeenCalled();});
  it("invalid structured output never validates as a complete course",()=>{expect(()=>parseCourseContent('{"overview":"partial"}')).toThrow();});
  it("refresh can confirm the actor's terminal retry key before explicit paid regeneration",async()=>{const u=await user(350);const other=await user();const c=await course();const req=input();await generateCourse(u.id,c.id,req);const statusRequest=(id:string)=>new NextRequest(`https://aifekr.test/api/admin/ai-courses/${c.id}?requestKey=${req.idempotencyKey}`,{headers:{cookie:`token=${signToken({userId:id,role:"ADMIN",plan:"STUDENT_FIRST_THREE_MONTHS"})}`}});expect(await (await detail(statusRequest(u.id),{params:{id:c.id}})).json()).toMatchObject({actorId:u.id,requestStatus:"SUCCEEDED"});expect(await (await detail(statusRequest(other.id),{params:{id:c.id}})).json()).toMatchObject({actorId:other.id,requestStatus:null});await generateCourse(u.id,c.id,{...input(),regenerate:true,confirmRegeneration:true});expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(150);});
  it("the existing insufficient-credit API flow returns 402 and purchase path",async()=>{const u=await user(99);const c=await course();const response=await generate(request(u.id,input()),{params:{id:c.id}});expect(response.status).toBe(402);expect(await response.json()).toMatchObject({code:"INSUFFICIENT_CREDITS",required:100,purchaseUrl:"/credits"});expect(model).not.toHaveBeenCalled();});
  it("a reused key with a changed request is rejected without another charge",async()=>{const u=await user();const c=await course();const req=input();await generateCourse(u.id,c.id,req);await expect(generateCourse(u.id,c.id,{...req,regenerate:true,confirmRegeneration:true})).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(50);});
  it("failed full regeneration preserves the published course and refunds the new reservation",async()=>{const u=await user(350);const c=await course();await generateCourse(u.id,c.id,input());const original=await prisma.aiCourse.update({where:{id:c.id},data:{status:"PUBLISHED"}});model.mockRejectedValue(new Error("Unavailable"));const job=await generateCourse(u.id,c.id,{...input(),regenerate:true,confirmRegeneration:true});expect(job.status).toBe("REFUNDED");const unchanged=await prisma.aiCourse.findUniqueOrThrow({where:{id:c.id}});expect(unchanged.status).toBe("PUBLISHED");expect(unchanged.content).toBe(original.content);expect(unchanged.version).toBe(original.version);expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(250);});
  it("only published courses appear to eligible students",async()=>{const u=await user();const draft=await course();const generated=await course();await generateCourse(u.id,generated.id,input());const published=await course();await prisma.aiCourse.update({where:{id:published.id},data:{content:JSON.stringify(validCourse),status:"PUBLISHED"}});const response=await catalog(request(u.id));expect(response.status).toBe(200);const ids=(await response.json()).courses.map((row:{id:string})=>row.id);expect(ids).toContain(published.id);expect(ids).not.toContain(draft.id);expect(ids).not.toContain(generated.id);});
  it("a server failure at commit rolls back the course and refunds credits",async()=>{const u=await user();const c=await course();const normal=model.getMockImplementation()!;let spy:ReturnType<typeof vi.spyOn>|undefined;let armed=false;model.mockImplementation(async(...args)=>{const value=await normal(...args);if(!armed&&args[1].includes("single complete lesson")){armed=true;spy=vi.spyOn(prisma,"$transaction").mockRejectedValueOnce(new Error("Simulated commit failure"));}return value;});try{const job=await generateCourse(u.id,c.id,input());expect(job.status).toBe("REFUNDED");expect((await prisma.user.findUniqueOrThrow({where:{id:u.id}})).credits).toBe(150);expect((await prisma.aiCourse.findUniqueOrThrow({where:{id:c.id}})).content).toBeNull();}finally{spy?.mockRestore();}});
});
