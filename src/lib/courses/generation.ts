import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { getAvailableCredits, reserveLoggedCredits, refundLoggedReservation } from "@/lib/utils/teamCredits";
import { buildCourse } from "./provider";
import { ZodError } from "zod";
import { logError } from "@/lib/logging/errorLog";
import type { AiCourseGenerationJob } from "@prisma/client";

export const COURSE_ACTION = "AI_COURSE_GENERATION";
const LEASE_MS = 5 * 60_000;
export class CourseError extends Error {
  constructor(public code: string, public status: number, public required?: number) { super(code); }
}
function audit(job: AiCourseGenerationJob, title: string) {
  return { action: COURSE_ACTION, feature: "course_generation", courseId: job.courseId, courseTitle: title, generationJobId: job.id, payerTeamId: job.payerTeamId, credits: job.credits, creditDelta: -job.credits, createdAt: job.createdAt.toISOString() };
}
export async function failCourseJob(jobId: string, code: string) {
  return prisma.$transaction(async tx => {
    const job = await tx.aiCourseGenerationJob.findUnique({ where: { id: jobId }, include: { course: true } });
    if (!job || job.status !== "GENERATING") return;
    const completedAt = new Date();
    const claim = await tx.aiCourseGenerationJob.updateMany({ where: { id: job.id, status: "GENERATING" }, data: { status: "REFUNDED", failureCode: code, completedAt } });
    if (!claim.count) return;
    await refundLoggedReservation(tx, job, { ...audit(job, job.course.title), failureCode: code, completedAt: completedAt.toISOString() });
    await tx.aiCourse.updateMany({ where: { id: job.courseId, activeJobId: job.id }, data: { activeJobId: null, status: job.previousStatus } });
  });
}
export async function reconcileCourseJobs() {
  const jobs = await prisma.aiCourseGenerationJob.findMany({ where: { status: "GENERATING", expiresAt: { lte: new Date() } }, select: { id: true }, take: 100 });
  for (const job of jobs) await failCourseJob(job.id, "GENERATION_TIMEOUT");
  return jobs.length;
}

export async function generateCourse(userId: string, courseId: string, input: { idempotencyKey: string; expectedCredits: number; regenerate?: boolean; confirmRegeneration?: boolean }) {
  await reconcileCourseJobs();
  const requestHash = createHash("sha256").update(JSON.stringify({ courseId, expectedCredits: input.expectedCredits, regenerate: !!input.regenerate, confirmRegeneration: !!input.confirmRegeneration })).digest("hex");
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
      if (!course.content && input.regenerate) throw new CourseError("NOTHING_TO_REGENERATE", 409);
      if (await getAvailableCredits(userId, tx) < cost) throw new CourseError("INSUFFICIENT_CREDITS", 402, cost);
      const id = randomUUID();
      const reservation = await reserveLoggedCredits(tx, userId, cost, { type: "course_generation", requestId: id, metadata: { action: COURSE_ACTION, status: "RESERVED", feature: "course_generation", courseTitle: course.title, courseId, generationJobId: id, creditDelta: -cost } });
      if (!reservation) throw new CourseError("INSUFFICIENT_CREDITS", 402, cost);
      const lock = await tx.aiCourse.updateMany({ where: { id: courseId, activeJobId: null, version: course.version }, data: { status: "GENERATING", activeJobId: id } });
      if (!lock.count) throw new CourseError("ALREADY_GENERATING", 409);
      return tx.aiCourseGenerationJob.create({ data: { id, userId, courseId, idempotencyKey: input.idempotencyKey, requestHash, credits: cost, previousStatus: course.status, expiresAt: new Date(Date.now() + LEASE_MS), ...reservation } });
    });
  } catch (error) {
    // A database uniqueness winner owns the operation; the loser never starts another model call.
    const winner = await prisma.aiCourseGenerationJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
    if (winner && winner.requestHash === requestHash) return winner;
    throw error;
  }
  try {
    const course = await prisma.aiCourse.findUniqueOrThrow({ where: { id: courseId } });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const {content,provider,providersUsed} = await Promise.race([
      buildCourse(course,Date.now()+180_000),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("GENERATION_TIMEOUT")), 180_000); }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
    await prisma.$transaction(async tx => {
      const completedAt = new Date();
      const claim = await tx.aiCourseGenerationJob.updateMany({ where: { id: job.id, status: "GENERATING", expiresAt: { gt: completedAt } }, data: { status: "SUCCEEDED", completedAt, provider: provider.id, model: provider.model } });
      if (!claim.count) throw new CourseError("JOB_NO_LONGER_ACTIVE", 409);
      const saved = await tx.aiCourse.updateMany({ where: { id: courseId, activeJobId: job.id }, data: { content: JSON.stringify(content), version: { increment: 1 }, status: "GENERATED", activeJobId: null, publishedAt: null } });
      if (!saved.count) throw new CourseError("COURSE_CONFLICT", 409);
      await tx.usageLog.update({ where: { id: job.usageLogId }, data: { provider: provider.id, model: provider.model, metadata: JSON.stringify({ ...audit(job, course.title), providersUsed, status: "COMMITTED", completedAt: completedAt.toISOString() }) } });
    });
  } catch (error) {
    const code = error instanceof Error && error.message === "GENERATION_TIMEOUT" ? "GENERATION_TIMEOUT" : error instanceof ZodError || error instanceof SyntaxError ? "INVALID_COURSE_OUTPUT" : "GENERATION_FAILED";
    await failCourseJob(job.id, code);
    // Log a safe category, not raw provider responses, keys or the course prompt.
    await logError({ source: "ai-course-generation", error: new Error(code), userId, requestId: job.id });
  }
  return prisma.aiCourseGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
}
