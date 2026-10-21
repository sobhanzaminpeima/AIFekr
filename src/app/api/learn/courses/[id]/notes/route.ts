import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {studentWorkspaceDisabledResponse} from "@/lib/student/access";
import {learningVersion} from "@/lib/courses/academy";
import {courseLessons} from "@/lib/courses/content";
import {courseError} from "@/lib/courses/http";
import {prisma} from "@/lib/db/prisma";
import {z} from "zod";
export const dynamic="force-dynamic";
async function context(req:NextRequest,id:string){const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};const denied=await studentWorkspaceDisabledResponse(user);if(denied)return {error:denied};const bound=await learningVersion(user.id,id),lessonId=req.nextUrl.searchParams.get("lesson")||"";if(!bound.enrollment)return {error:NextResponse.json({error:"ENROLLMENT_REQUIRED"},{status:409})};if(lessonId!=="final"&&!courseLessons(bound.content).some(l=>l.id===lessonId))return {error:NextResponse.json({error:"LESSON_NOT_FOUND"},{status:404})};return {key:{userId:user.id,versionId:bound.version.id,lessonId}};}
export async function GET(req:NextRequest,{params}:{params:{id:string}}){try{const c=await context(req,params.id);if(c.error)return c.error;const note=await prisma.aiCourseLessonNote.findUnique({where:{userId_versionId_lessonId:c.key!}});return NextResponse.json({note:note?{content:note.content,updatedAt:note.updatedAt}:null},{headers:{"Cache-Control":"private, no-store"}});}catch(e){return courseError(e);}}
export async function PUT(req:NextRequest,{params}:{params:{id:string}}){try{const c=await context(req,params.id);if(c.error)return c.error;const input=z.object({content:z.string().max(20000)}).strict().safeParse(await req.json().catch(()=>null));if(!input.success)return NextResponse.json({error:"INVALID_NOTE"},{status:400});const note=await prisma.aiCourseLessonNote.upsert({where:{userId_versionId_lessonId:c.key!},create:{...c.key!,content:input.data.content},update:{content:input.data.content}});return NextResponse.json({note:{content:note.content,updatedAt:note.updatedAt}});}catch(e){return courseError(e);}}
