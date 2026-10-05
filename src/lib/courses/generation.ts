import {preserveRevision} from "./revisions";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { getAvailableCredits, reserveLoggedCredits, refundLoggedReservation } from "@/lib/utils/teamCredits";
import { buildCourse,buildBlueprint,outlineSchema } from "./provider";
import { ZodError } from "zod";
import { logError } from "@/lib/logging/errorLog";
import type { AiCourseGenerationJob } from "@prisma/client";
import {snapshotPublished} from "./academy";
import {generateFragment} from "./regeneration";

export const COURSE_ACTION = "AI_COURSE_GENERATION";
function sourceFingerprint(c:{title:string;description:string;fieldOfStudy:string;language:string;configuration:string;version:number},blueprint:string){return createHash("sha256").update(JSON.stringify({title:c.title,description:c.description,fieldOfStudy:c.fieldOfStudy,language:c.language,configuration:c.configuration,version:c.version,blueprint})).digest("hex");}
const LEASE_MS = 5 * 60_000;
import {CourseError} from "./errors";
export {CourseError} from "./errors";
function audit(job: AiCourseGenerationJob, title: string) {
  const fragment=job.phase==="FRAGMENT"?JSON.parse(job.checkpoint):null;
  return { action: fragment?.action||COURSE_ACTION, feature: fragment?.feature||"course_generation", courseId: job.courseId, courseTitle: title, generationJobId: job.id, payerTeamId: job.payerTeamId, credits: job.credits, creditDelta: -job.credits, createdAt: job.createdAt.toISOString() };
}
export async function failCourseJob(jobId: string, code: string) {
  return prisma.$transaction(async tx => {
    const job = await tx.aiCourseGenerationJob.findUnique({ where: { id: jobId }, include: { course: true } });
    if (!job || !["GENERATING","QUEUED_BLUEPRINT","QUEUED_CONTENT","AWAITING_BLUEPRINT_APPROVAL"].includes(job.status)) return;
    const completedAt = new Date();
    const claim = await tx.aiCourseGenerationJob.updateMany({ where: { id: job.id, status: job.status }, data: { status: "REFUNDED", failureCode: code, completedAt } });
    if (!claim.count) return;
    await refundLoggedReservation(tx, job, { ...audit(job, job.course.title), failureCode: code, completedAt: completedAt.toISOString() });
    await tx.aiCourse.updateMany({ where: { id: job.courseId, activeJobId: job.id }, data: { activeJobId: null, status: job.previousStatus } });
  });
}
export async function reconcileCourseJobs() {
  const jobs = await prisma.aiCourseGenerationJob.findMany({ where: { status: {in:["GENERATING","QUEUED_BLUEPRINT","QUEUED_CONTENT","AWAITING_BLUEPRINT_APPROVAL"]}, expiresAt: { lte: new Date() } }, select: { id: true }, take: 100 });
  for (const job of jobs) await failCourseJob(job.id, "GENERATION_TIMEOUT");
  return jobs.length;
}

export async function generateCourse(userId: string, courseId: string, input: { idempotencyKey: string; expectedCredits: number; regenerate?: boolean; confirmRegeneration?: boolean; phase?:"BLUEPRINT" }) {
  await reconcileCourseJobs();
  const requestHash = createHash("sha256").update(JSON.stringify({ courseId, expectedCredits: input.expectedCredits, regenerate: !!input.regenerate, confirmRegeneration: !!input.confirmRegeneration,phase:input.phase||"FULL" })).digest("hex");
  const existing = await prisma.aiCourseGenerationJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
  if (existing) {
    if (existing.requestHash !== requestHash) throw new CourseError("IDEMPOTENCY_CONFLICT", 409);
    return existing;
  }
  const cost = (await getCreditCosts())[COURSE_ACTION];
  if (!Number.isSafeInteger(cost) || cost < 0) throw new CourseError("INVALID_CREDIT_CONFIGURATION", 503);
  if (input.expectedCredits !== cost) throw new CourseError("COST_CHANGED", 409, cost);
  let job: AiCourseGenerationJob;
  try {
    job = await prisma.$transaction(async tx => {
      const course = await tx.aiCourse.findUnique({ where: { id: courseId } });
      if (!course) throw new CourseError("COURSE_NOT_FOUND", 404);
      if (course.activeJobId) throw new CourseError("ALREADY_GENERATING", 409);
      if (course.content && (!input.regenerate || !input.confirmRegeneration)) throw new CourseError("REGENERATION_CONFIRMATION_REQUIRED", 409);
      if(course.status==="PUBLISHED")await snapshotPublished(tx,course);
      if (!course.content && input.regenerate) throw new CourseError("NOTHING_TO_REGENERATE", 409);
      if (await getAvailableCredits(userId, tx) < cost) throw new CourseError("INSUFFICIENT_CREDITS", 402, cost);
      const failed=input.phase&&course.blueprint?await tx.aiCourseGenerationJob.findFirst({where:{courseId,userId,phase:"CONTENT",status:"REFUNDED"},orderBy:{createdAt:"desc"}}):null;
      const checkpoint=failed?JSON.parse(failed.checkpoint):{};
      const resume=!!(course.blueprint&&checkpoint._source===sourceFingerprint(course,course.blueprint));
      const id = randomUUID();
      const reservation = await reserveLoggedCredits(tx, userId, cost, { type: "course_generation", requestId: id, metadata: { action: COURSE_ACTION, status: "RESERVED", feature: "course_generation", courseTitle: course.title, courseId, generationJobId: id, creditDelta: -cost } });
      if (!reservation) throw new CourseError("INSUFFICIENT_CREDITS", 402, cost);
      const lock = await tx.aiCourse.updateMany({ where: { id: courseId, activeJobId: null, version: course.version }, data: { status: "GENERATING", activeJobId: id } });
      if (!lock.count) throw new CourseError("ALREADY_GENERATING", 409);
      return tx.aiCourseGenerationJob.create({ data: { id, userId, courseId, idempotencyKey: input.idempotencyKey, requestHash, credits: cost, previousStatus: course.status, expiresAt: new Date(Date.now() + (input.phase?86400000:LEASE_MS)),phase:resume?"CONTENT":input.phase||"FULL",status:resume?"QUEUED_CONTENT":input.phase?"QUEUED_BLUEPRINT":"GENERATING",checkpoint:resume?failed!.checkpoint:"{}", ...reservation } });
    });
  } catch (error) {
    // A database uniqueness winner owns the operation; the loser never starts another model call.
    const winner = await prisma.aiCourseGenerationJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
    if (winner && winner.requestHash === requestHash) return winner;
    throw error;
  }
  if(input.phase)return job;
  return runReservedCourseJob(job);
}
export async function runReservedCourseJob(job:AiCourseGenerationJob){
  const {courseId,userId}=job;
  try {
    const course = await prisma.aiCourse.findUniqueOrThrow({ where: { id: courseId } });
    if(job.phase==="FRAGMENT"){
      let timeout:ReturnType<typeof setTimeout>|undefined;
      const generated=await Promise.race([generateFragment(job),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(Error("GENERATION_TIMEOUT")),180000);})]).finally(()=>{if(timeout)clearTimeout(timeout);});
      await prisma.$transaction(async tx=>{const now=new Date(),claim=await tx.aiCourseGenerationJob.updateMany({where:{id:job.id,status:"GENERATING",expiresAt:{gt:now}},data:{status:"PREVIEW_READY",completedAt:now,provider:generated.provider.id,model:generated.provider.model,checkpoint:JSON.stringify({...JSON.parse(job.checkpoint),candidate:generated.content,description:generated.description})}});if(!claim.count)throw Error("JOB_NO_LONGER_ACTIVE");await tx.aiCourse.updateMany({where:{id:courseId,activeJobId:job.id},data:{activeJobId:null,status:job.previousStatus}});await tx.usageLog.update({where:{id:job.usageLogId},data:{provider:generated.provider.id,model:generated.provider.model,metadata:JSON.stringify({...audit(job,course.title),status:"COMMITTED",completedAt:now.toISOString()})}});});
      return prisma.aiCourseGenerationJob.findUniqueOrThrow({where:{id:job.id}});
    }
    if(job.phase==="BLUEPRINT"){
      let blueprintTimer:ReturnType<typeof setTimeout>|undefined;
      const {outline,provider}=await Promise.race([buildBlueprint(course,Date.now()+120000),new Promise<never>((_,reject)=>{blueprintTimer=setTimeout(()=>reject(Error("GENERATION_TIMEOUT")),120000);})]).finally(()=>{if(blueprintTimer)clearTimeout(blueprintTimer);});
      await prisma.$transaction(async tx=>{
        const changed=await tx.aiCourseGenerationJob.updateMany({where:{id:job.id,status:"GENERATING",expiresAt:{gt:new Date()}},data:{status:"AWAITING_BLUEPRINT_APPROVAL",provider:provider.id,model:provider.model,expiresAt:new Date(Date.now()+86400000)}});
        if(!changed.count)throw Error("JOB_NO_LONGER_ACTIVE");
        await tx.aiCourse.update({where:{id:courseId},data:{blueprint:JSON.stringify(outline),blueprintApprovedAt:null,status:"BLUEPRINT_REVIEW"}});
      });return prisma.aiCourseGenerationJob.findUniqueOrThrow({where:{id:job.id}});
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const generated = await Promise.race([
      buildCourse(course,Date.now()+180_000,job.phase==="CONTENT"?{approved:true,maxLessons:8,checkpoint:JSON.parse(job.checkpoint),save:async(key,value)=>{
        // Serialize checkpoint writes across lesson workers without overwriting other lessons.
        await prisma.$transaction(async tx=>{const active=await tx.aiCourseGenerationJob.findUniqueOrThrow({where:{id:job.id}});if(active.status!=="GENERATING")throw Error("JOB_NO_LONGER_ACTIVE");await tx.aiCourseGenerationJob.update({where:{id:job.id},data:{checkpoint:JSON.stringify({...JSON.parse(active.checkpoint),[key]:value})}});});
      }}:undefined),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("GENERATION_TIMEOUT")), 180_000); }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
    if(generated.pending){await prisma.$transaction(async tx=>{const active=await tx.aiCourseGenerationJob.findUniqueOrThrow({where:{id:job.id}}),checkpoint=JSON.parse(active.checkpoint);const changed=await tx.aiCourseGenerationJob.updateMany({where:{id:job.id,status:"GENERATING",expiresAt:{gt:new Date()}},data:{status:"QUEUED_CONTENT",expiresAt:new Date(Date.now()+86400000),checkpoint:JSON.stringify({...checkpoint,_providers:generated.providersUsed})}});if(!changed.count)throw new CourseError("JOB_NO_LONGER_ACTIVE",409);});return prisma.aiCourseGenerationJob.findUniqueOrThrow({where:{id:job.id}});}
    const {content,provider,providersUsed}=generated;
    await prisma.$transaction(async tx => {
      const completedAt = new Date();
      const claim = await tx.aiCourseGenerationJob.updateMany({ where: { id: job.id, status: "GENERATING", expiresAt: { gt: completedAt } }, data: { status: "SUCCEEDED", completedAt, provider: provider.id, model: provider.model } });
      if (!claim.count) throw new CourseError("JOB_NO_LONGER_ACTIVE", 409);
      await preserveRevision(tx,course,userId,"FULL_GENERATION");
const saved = await tx.aiCourse.updateMany({ where: { id: courseId, activeJobId: job.id }, data: { content: JSON.stringify(content), version: { increment: 1 }, status: "GENERATED", activeJobId: null, publishedAt: null } });
      if (!saved.count) throw new CourseError("COURSE_CONFLICT", 409);
      await tx.usageLog.update({ where: { id: job.usageLogId }, data: { provider: provider.id, model: provider.model, metadata: JSON.stringify({ ...audit(job, course.title), providersUsed, status: "COMMITTED", completedAt: completedAt.toISOString() }) } });
    });
  } catch (error) {
    const code = error instanceof Error && error.message === "GENERATION_TIMEOUT" ? "GENERATION_TIMEOUT" : error instanceof ZodError || error instanceof SyntaxError ? "INVALID_COURSE_OUTPUT" : "GENERATION_FAILED";
    await failCourseJob(job.id, code);
    // Log a safe category, not raw provider responses, keys or the course prompt.
    const fields=error instanceof ZodError?error.issues.slice(0,12).map(i=>`${i.path.join(".")}:${i.code}`).join(","):"";
    await logError({ source: "ai-course-generation", error: new Error(fields?`${code} [${fields}]`:code), userId, requestId: job.id });
  }
  return prisma.aiCourseGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
}

export async function processQueuedCourseJobs(){
  await reconcileCourseJobs();
  const queued=await prisma.aiCourseGenerationJob.findFirst({where:{status:{in:["QUEUED_BLUEPRINT","QUEUED_CONTENT"]},expiresAt:{gt:new Date()}},orderBy:{createdAt:"asc"}});
  if(!queued)return null;
  const claimed=await prisma.aiCourseGenerationJob.updateMany({where:{id:queued.id,status:queued.status},data:{status:"GENERATING",expiresAt:new Date(Date.now()+LEASE_MS)}});
  if(!claimed.count)return null;
  return runReservedCourseJob(await prisma.aiCourseGenerationJob.findUniqueOrThrow({where:{id:queued.id}}));
}
export async function approveBlueprint(adminId:string,courseId:string,blueprint:unknown){
  const parsed=outlineSchema.parse(blueprint);
  return prisma.$transaction(async tx=>{
    const course=await tx.aiCourse.findUniqueOrThrow({where:{id:courseId}});if(!course.activeJobId)throw new CourseError("NO_ACTIVE_GENERATION",409);
    const claim=await tx.aiCourseGenerationJob.updateMany({where:{id:course.activeJobId,status:"AWAITING_BLUEPRINT_APPROVAL",expiresAt:{gt:new Date()}},data:{status:"QUEUED_CONTENT",phase:"CONTENT",checkpoint:JSON.stringify({_source:sourceFingerprint(course,JSON.stringify(parsed))}),expiresAt:new Date(Date.now()+86400000)}});if(!claim.count)throw new CourseError("BLUEPRINT_NOT_AWAITING_APPROVAL",409);
    await tx.aiCourse.update({where:{id:courseId},data:{blueprint:JSON.stringify(parsed),blueprintApprovedAt:new Date(),status:"GENERATING"}});
    await tx.auditLog.create({data:{actorId:adminId,action:"academy_blueprint_approved",targetId:courseId}});
    return tx.aiCourseGenerationJob.findUniqueOrThrow({where:{id:course.activeJobId}});
  });
}
