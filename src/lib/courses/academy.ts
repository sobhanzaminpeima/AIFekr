import {z} from "zod";
import {prisma} from "@/lib/db/prisma";
import type {Prisma} from "@prisma/client";
import {courseLessons,parseCourseContent} from "./content";
import {CourseError} from "./generation";
import {randomBytes,randomUUID} from "node:crypto";
export const completionRules=z.object({lessonPercent:z.number().int().min(1).max(100).default(100),quizScore:z.number().int().min(1).max(100).default(70),finalRequired:z.boolean().default(true),finalScore:z.number().int().min(1).max(100).default(75),attemptLimit:z.number().int().min(0).max(100).default(0)});
export const legacyRules={lessonPercent:100,quizScore:60,finalRequired:false,finalScore:75,attemptLimit:0};
export const courseConfiguration=z.object({requirements:completionRules.optional(),audience:z.string().max(1000).default("University students"),teachingStyle:z.string().max(1000).default("Practical"),depth:z.string().max(1000).default("Intermediate"),chapterCount:z.number().int().min(3).max(12).default(6),instructions:z.string().max(6000).default(""),learningObjectives:z.array(z.string().trim().min(3).max(500)).max(15).default([])});
export function requirements(config:string){return completionRules.parse(JSON.parse(config).requirements||legacyRules);}
export function progressPercent(progress:{completed:string;quizPassed:string;finalPassed:boolean;state:string},content:ReturnType<typeof parseCourseContent>,rules:ReturnType<typeof completionRules.parse>){
  return progressPercentForIds(progress,courseLessons(content).map(l=>l.id),rules);
}
export function progressPercentForIds(progress:{completed:string;quizPassed:string;finalPassed:boolean;state:string},ids:string[],rules:ReturnType<typeof completionRules.parse>){
  if(progress.state==="COMPLETED")return 100;
  const done=new Set<string>(JSON.parse(progress.completed)),passed=new Set<string>(JSON.parse(progress.quizPassed));
  return Math.min(99,Math.floor((ids.filter(id=>done.has(id)).length+ids.filter(id=>passed.has(id)).length+(rules.finalRequired&&progress.finalPassed?1:0))/(ids.length*2+(rules.finalRequired?1:0))*100));
}
export async function snapshotPublished(tx:Prisma.TransactionClient,course:Awaited<ReturnType<typeof tx.aiCourse.findUniqueOrThrow>>){
  if(!course.content)throw new CourseError("EMPTY_COURSE",409);
  const content=parseCourseContent(course.content),rules=requirements(course.configuration);
  if(rules.finalRequired&&!content.finalAssessment?.length&&!content.finalAssessmentQuestions?.length)throw new CourseError("FINAL_ASSESSMENT_REQUIRED",409);
  const targets=await tx.aiCourseMajor.findMany({where:{courseId:course.id},select:{majorId:true}});
  const published=await tx.aiCourseVersion.upsert({where:{courseId_version:{courseId:course.id,version:course.version}},create:{courseId:course.id,version:course.version,title:course.title,description:course.description,language:course.language,difficulty:course.difficulty,durationMinutes:course.durationMinutes,topic:course.topic,skills:course.skills,coverUrl:course.coverUrl,prerequisites:course.prerequisites,majorIds:JSON.stringify(targets.map(t=>t.majorId)),content:course.content,requirements:JSON.stringify(rules),metadata:JSON.stringify({moduleCount:content.chapters.length,lessonIds:courseLessons(content).map(l=>l.id),fieldOfStudy:course.fieldOfStudy,durationMinutes:course.durationMinutes,skills:JSON.parse(course.skills),difficulty:course.difficulty})},update:{}});if(course.status==="PUBLISHED")await tx.aiCourse.update({where:{id:course.id},data:{publishedVersionId:published.id}});return published;
}
export async function enroll(userId:string,courseId:string){return prisma.$transaction(async tx=>{
  const prior=await tx.aiCourseProgress.findFirst({where:{userId,courseId,versionId:{not:null},state:{not:"ARCHIVED"}},orderBy:{createdAt:"desc"}});if(prior)return prior;
  const course=await tx.aiCourse.findFirst({where:{id:courseId,publishedVersionId:{not:null}}});if(!course?.publishedVersionId)throw new CourseError("COURSE_NOT_FOUND",404);
  const version=await tx.aiCourseVersion.findUniqueOrThrow({where:{id:course.publishedVersionId!}});if(version.courseId!==courseId)throw new CourseError("COURSE_VERSION_NOT_READY",409);
  return tx.aiCourseProgress.upsert({where:{userId_courseId_version:{userId,courseId,version:version.version}},create:{userId,courseId,version:version.version,versionId:version.id,startedAt:new Date(),lastActivityAt:new Date(),state:"IN_PROGRESS"},update:{versionId:version.id,lastActivityAt:new Date()}});
});}
export async function learningVersion(userId:string,courseId:string){
  const enrollment=await prisma.aiCourseProgress.findFirst({where:{userId,courseId,versionId:{not:null},state:{not:"ARCHIVED"}},orderBy:{createdAt:"desc"}});
  const version=enrollment?.versionId?await prisma.aiCourseVersion.findUnique({where:{id:enrollment.versionId}}):null;
  if(version&&version.courseId!==courseId)throw new CourseError("COURSE_VERSION_NOT_READY",409);
  if(version)return {version,enrollment,content:parseCourseContent(version.content)};
  const course=await prisma.aiCourse.findFirst({where:{id:courseId,publishedVersionId:{not:null}},include:{publishedVersion:true}});if(!course?.publishedVersion)throw new CourseError("COURSE_NOT_FOUND",404);
  return {version:course.publishedVersion,enrollment:null,content:parseCourseContent(course.publishedVersion.content)};
}
/** Only this transaction-bound validator can issue a verified certificate. */
export async function validateCompletion(tx:Prisma.TransactionClient,enrollmentId:string){
  const e=await tx.aiCourseProgress.findUniqueOrThrow({where:{id:enrollmentId}});if(!e.versionId)return null;
  const prior=await tx.aiCourseCompletion.findUnique({where:{enrollmentId},include:{certificate:true}});if(prior)return prior;
  const v=await tx.aiCourseVersion.findUniqueOrThrow({where:{id:e.versionId}}),content=parseCourseContent(v.content),lessons=courseLessons(content),rules=completionRules.parse(JSON.parse(v.requirements));
  const completed=new Set<string>(JSON.parse(e.completed)),passed=new Set<string>(JSON.parse(e.quizPassed));
  if(lessons.filter(x=>completed.has(x.id)).length/lessons.length*100<rules.lessonPercent||!lessons.every(x=>passed.has(x.id))||(rules.finalRequired&&!e.finalPassed))return null;
  const attempts=await tx.aiCourseAssessmentAttempt.findMany({where:{enrollmentId,passed:true}});
  if(!lessons.every(x=>attempts.some(a=>a.assessmentId===x.id&&a.score>=rules.quizScore))||(rules.finalRequired&&!attempts.some(a=>a.assessmentId==="final"&&a.score>=rules.finalScore)))return null;
  const user=await tx.user.findUniqueOrThrow({where:{id:e.userId},select:{name:true}}),meta=JSON.parse(v.metadata),id=randomUUID();
  const final=attempts.filter(a=>a.assessmentId==="final").sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())[0];
  const completion=await tx.aiCourseCompletion.create({data:{enrollmentId,userId:e.userId,courseId:e.courseId,versionId:v.id,score:final?.score,certificate:{create:{id,verificationCode:randomBytes(24).toString("hex"),studentName:user.name||"AIFekr Student",courseTitle:v.title,version:v.version,learningArea:meta.fieldOfStudy||"",durationMinutes:meta.durationMinutes||0,skills:JSON.stringify(meta.skills||[])}}},include:{certificate:true}});
  await tx.aiCourseProgress.update({where:{id:enrollmentId},data:{state:"COMPLETED",completedAt:new Date(),certificateId:id,certificateTitle:v.title,certificateName:user.name||"AIFekr Student"}});
  await tx.auditLog.create({data:{actorId:e.userId,action:"academy_certificate_issued",targetId:id,metadata:JSON.stringify({completionId:completion.id,versionId:v.id,...(e.state==="LEGACY_COMPLETED"?{legacyCertificateId:e.certificateId}:{})})}});
  return completion;
}
export async function verifyCertificate(code:string){if(!/^[a-f0-9]{48}$/.test(code))return null;const certificate=await prisma.aiCourseCertificate.findUnique({where:{verificationCode:code},select:{id:true,studentName:true,courseTitle:true,version:true,status:true,issuedAt:true,learningArea:true}});if(certificate)await prisma.aiCourseCertificate.updateMany({where:{id:certificate.id},data:{verificationCount:{increment:1},lastVerifiedAt:new Date()}}).catch(()=>{});return certificate;}
