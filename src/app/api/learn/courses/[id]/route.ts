export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {studentWorkspaceDisabledResponse} from "@/lib/student/access";
import {learningVersion,progressPercent,completionRules} from "@/lib/courses/academy";
import {prisma} from "@/lib/db/prisma";
import {courseError} from "@/lib/courses/http";
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const denied=await studentWorkspaceDisabledResponse(user);if(denied)return denied;
 try{const {version,content,enrollment}=await learningVersion(user.id,params.id);const completion=enrollment?await prisma.aiCourseCompletion.findUnique({where:{enrollmentId:enrollment.id},select:{score:true,certificate:{select:{id:true,verificationCode:true,status:true}}}}):null;return NextResponse.json({certificate:completion?.certificate,finalScore:completion?.score,course:{id:params.id,title:version.title,description:version.description,language:version.language,version:version.version,...JSON.parse(version.metadata),requirements:JSON.parse(version.requirements),content:{overview:content.overview,objectives:content.objectives,chapters:content.chapters.map((c,ci)=>({title:c.title,lessons:c.lessons.map((l,li)=>({id:`${ci}:${li}`,title:l.title}))})),finalProject:{title:content.finalProject.title},hasFinalAssessment:!!(content.finalAssessment?.length||content.finalAssessmentQuestions?.length)}},progress:enrollment?{...enrollment,progressPercent:progressPercent(enrollment,content,completionRules.parse(JSON.parse(version.requirements)))}:null},{headers:{"Cache-Control":"private, no-store"}});}catch(error){return courseError(error);}
}
