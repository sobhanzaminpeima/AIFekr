import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {studentWorkspaceDisabledResponse} from "@/lib/student/access";
import {learningVersion} from "@/lib/courses/academy";
import {selectAssessment} from "@/lib/courses/assessmentSelection";
import {legacyQuestions,publicQuestion} from "@/lib/courses/assessment";
import {courseLessons} from "@/lib/courses/content";
import {courseError} from "@/lib/courses/http";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const denied=await studentWorkspaceDisabledResponse(user);if(denied)return denied;
 try{const {content,version}=await learningVersion(user.id,params.id),id=req.nextUrl.searchParams.get("lesson"),lesson=id==="final"?{id:"final",title:content.finalProject.title,content:content.finalProject.instructions,activity:content.finalProject.rubric.join("\n"),quiz:content.finalAssessment||[],assessmentQuestions:content.finalAssessmentQuestions,assessmentSettings:content.finalAssessmentSettings}:courseLessons(content).find(x=>x.id===id);
 if(!lesson)return NextResponse.json({error:"LESSON_NOT_FOUND"},{status:404});const questions=lesson.assessmentQuestions||legacyQuestions(lesson.quiz),selected=lesson.assessmentSettings&&questions.length?selectAssessment({userId:user.id,versionId:version.id,lessonId:lesson.id},questions.length,lesson.assessmentSettings):null;
 return NextResponse.json({lesson:{...lesson,assessmentQuestions:undefined,assessmentToken:selected?.token,quiz:(selected?selected.indices.map(i=>questions[i]):questions).map(publicQuestion)}},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return courseError(error);}
}
