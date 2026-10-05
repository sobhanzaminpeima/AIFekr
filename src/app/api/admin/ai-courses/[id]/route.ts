import {preserveRevision} from "@/lib/courses/revisions";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { COURSE_CONTENT_LIMIT,courseContentSchema } from "@/lib/courses/content";
import { reconcileCourseJobs } from "@/lib/courses/generation";
import { courseBrief } from "@/lib/courses/content";
import {snapshotPublished,courseConfiguration} from "@/lib/courses/academy";
import {z} from "zod";
import {courseError} from "@/lib/courses/http";
const academyMetadata=z.object({difficulty:z.enum(["BEGINNER","INTERMEDIATE","ADVANCED"]).optional(),durationMinutes:z.number().int().min(5).max(60000).optional(),topic:z.string().max(200).optional(),prerequisites:z.string().max(3000).optional(),skills:z.array(z.string().min(1).max(100)).max(40).optional(),coverUrl:z.string().url().refine(s=>s.startsWith("https://")).nullable().optional(),configuration:courseConfiguration.optional(),majorIds:z.array(z.string().max(100)).max(30).optional()});
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req); if (!admin) return forbiddenResponse();
  await reconcileCourseJobs();
  const course = await prisma.aiCourse.findUnique({ where: { id: params.id }, include: { publishedVersion:{select:{version:true}},majors:true,jobs: { orderBy: { createdAt: "desc" }, take: 10 } } });
  const requestKey = req.nextUrl.searchParams.get("requestKey");
  if (requestKey && !/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey)) return NextResponse.json({ error: "INVALID_REQUEST_KEY" }, { status: 400 });
  const request = requestKey ? await prisma.aiCourseGenerationJob.findFirst({ where: { userId: admin.id, courseId: params.id, idempotencyKey: requestKey }, select: { status: true } }) : null;
  const total=course?.blueprint?JSON.parse(course.blueprint).chapters.reduce((n:number,c:{lessons:string[]})=>n+c.lessons.length,0):0;
  return course ? NextResponse.json({ course:{...course,jobs:course.jobs.map(({checkpoint,...job})=>({...job,generatedLessons:Object.keys(JSON.parse(checkpoint)).filter(k=>/^\d+:\d+$/.test(k)).length,totalLessons:total}))}, actorId: admin.id, requestStatus: request?.status || null }, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req); if (!admin) return forbiddenResponse();
  const body = await req.json().catch(() => null);
  if (!body || !Number.isSafeInteger(body.version)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const course = await prisma.aiCourse.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (course.activeJobId) return NextResponse.json({ error: "ALREADY_GENERATING" }, { status: 409 });
  const brief = courseBrief.safeParse({ fieldOfStudy: body.fieldOfStudy ?? course.fieldOfStudy, title: body.title ?? course.title, description: body.description ?? course.description, language: body.language ?? course.language });
  if (!brief.success) return NextResponse.json({ error: "INVALID_COURSE_BRIEF" }, { status: 400 });
  if(body.content&&JSON.stringify(body.content).length>COURSE_CONTENT_LIMIT)return NextResponse.json({error:"COURSE_CONTENT_TOO_LARGE"},{status:400});
  const parsed = body.content !== undefined ? courseContentSchema.safeParse(body.content) : null;
  if (parsed && !parsed.success) return NextResponse.json({ error: "INVALID_COURSE_CONTENT" }, { status: 400 });
  const metadata=academyMetadata.safeParse(body);if(!metadata.success)return NextResponse.json({error:"INVALID_ACADEMY_METADATA"},{status:400});
  const status = body.status ?? (parsed ? "GENERATED" : course.status === "PUBLISHED" ? "GENERATED" : course.status);
  if (!["DRAFT", "GENERATED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"].includes(status)) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  if (status === "PUBLISHED" && (!course.content || !["GENERATED", "PUBLISHED"].includes(course.status) || parsed)) return NextResponse.json({ error: "REVIEW_BEFORE_PUBLISH" }, { status: 409 });
  let result;
  try { result=await prisma.$transaction(async tx=>{
    const {skills,configuration,majorIds,...extra}=metadata.data;
    await preserveRevision(tx,course,admin.id,"MANUAL_EDIT");
if(course.status==="PUBLISHED")await snapshotPublished(tx,course);
    if(majorIds && await tx.academicMajor.count({where:{id:{in:majorIds},status:"ACTIVE"}})!==new Set(majorIds).size)throw new Error("INVALID_MAJOR");
    const changed=await tx.aiCourse.updateMany({where:{id:course.id,version:body.version,activeJobId:null},data:{...brief.data,...extra,version:{increment:1},...(skills?{skills:JSON.stringify(skills)}:{}),...(configuration?{configuration:JSON.stringify(configuration)}:{}),...(parsed?.success?{content:JSON.stringify(parsed.data)}:{}),status,...(["UNPUBLISHED","ARCHIVED"].includes(status)?{publishedVersionId:null}:{}),publishedAt:status==="PUBLISHED"?new Date():null}});
    if(!changed.count)return changed;
    if(majorIds){await tx.aiCourseMajor.deleteMany({where:{courseId:course.id}});for(const majorId of Array.from(new Set(majorIds)))await tx.aiCourseMajor.create({data:{courseId:course.id,majorId}});}
    if(status==="PUBLISHED")await snapshotPublished(tx,await tx.aiCourse.findUniqueOrThrow({where:{id:course.id}}));
    await tx.auditLog.create({data:{actorId:admin.id,action:status==="PUBLISHED"?"academy_course_published":"academy_course_edited",targetId:course.id,metadata:JSON.stringify({version:course.version+1,status})}});
    return changed;
  });} catch(error){return courseError(error);}
  if (!result.count) return NextResponse.json({ error: "COURSE_CHANGED_REFRESH" }, { status: 409 });
  return NextResponse.json({ course: await prisma.aiCourse.findUnique({ where: { id: course.id } }) });
}
