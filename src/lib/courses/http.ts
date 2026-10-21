import { NextResponse } from "next/server";
import { CourseError } from "./generation";
export function courseError(error: unknown) {
  if (error instanceof CourseError) return NextResponse.json({ error: error.code, code: error.code, required: error.required, purchaseUrl: error.code === "INSUFFICIENT_CREDITS" ? "/credits" : undefined }, { status: error.status });
  return NextResponse.json({ error: "COURSE_REQUEST_FAILED", code: "COURSE_REQUEST_FAILED" }, { status: 500 });
}
export function courseJobView(job: { id: string; courseId: string; status: string; credits: number; failureCode: string | null; completedAt: Date | null; createdAt: Date }) {
  return { id: job.id, courseId: job.courseId, status: job.status, credits: job.credits, failureCode: job.failureCode, completedAt: job.completedAt, createdAt: job.createdAt };
}
