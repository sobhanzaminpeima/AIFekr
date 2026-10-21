import {prisma} from "@/lib/db/prisma";
import {parseCourseContent,courseLessons} from "./content";
import {CourseError} from "./generation";
import {enroll,completionRules,validateCompletion,progressPercent} from "./academy";
import {answerValid,answerCorrect,legacyQuestions,QuizAnswer} from "./assessment";
import {verifyAssessment} from "./assessmentSelection";
import {randomUUID} from "node:crypto";
export async function publishedCourse(id:string){const course=await prisma.aiCourse.findFirst({where:{id,status:"PUBLISHED"}});if(!course?.content)throw new CourseError("COURSE_NOT_FOUND",404);return {course,content:parseCourseContent(course.content)};}
/** Enrollment locks content; deterministic activities never invoke AI or charge credits. */
export async function saveCourseProgress(userId:string,courseId:string,input:{lessonId:string;action:"complete"|"quiz"|"start";answers?:QuizAnswer[];assessmentToken?:string;requestKey?:string}){
  const enrollment=await enroll(userId,courseId);
  return prisma.$transaction(async tx=>{
    const progress=await tx.aiCourseProgress.findUniqueOrThrow({where:{id:enrollment.id}});
    const version=await tx.aiCourseVersion.findUniqueOrThrow({where:{id:progress.versionId!}}),content=parseCourseContent(version.content),rules=completionRules.parse(JSON.parse(version.requirements));
    const lessons=courseLessons(content),lesson=lessons.find(x=>x.id===input.lessonId),isFinal=input.lessonId==="final";
    if(!lesson&&!isFinal)throw new CourseError("LESSON_NOT_FOUND",404);
    const completed:string[]=JSON.parse(progress.completed),passed:string[]=JSON.parse(progress.quizPassed);
    let result;let finalPassed=progress.finalPassed;
    if(input.action==="quiz"){
      let questions=isFinal?(content.finalAssessmentQuestions||(content.finalAssessment?legacyQuestions(content.finalAssessment):undefined)):(lesson!.assessmentQuestions||legacyQuestions(lesson!.quiz));if(!questions?.length)throw new CourseError("ASSESSMENT_NOT_FOUND",404);
      const settings=isFinal?content.finalAssessmentSettings:lesson!.assessmentSettings;
      const indices=settings?verifyAssessment(input.assessmentToken,{userId,versionId:version.id,lessonId:input.lessonId},questions.length,settings):undefined;
      if(indices)questions=indices.map(i=>questions![i]);
      const attemptAnswers=JSON.stringify(indices?{answers:input.answers,indices}:input.answers);
      if(!input.answers||input.answers.length!==questions.length||questions.some((q,i)=>!answerValid(q,input.answers![i])))throw new CourseError("ANSWER_ALL_QUESTIONS",400);
      const key=input.requestKey||randomUUID();
      const prior=await tx.aiCourseAssessmentAttempt.findUnique({where:{enrollmentId_requestKey:{enrollmentId:progress.id,requestKey:key}}});
      if(prior&&(prior.assessmentId!==input.lessonId||prior.answers!==attemptAnswers))throw new CourseError("IDEMPOTENCY_CONFLICT",409);
      const count=await tx.aiCourseAssessmentAttempt.count({where:{enrollmentId:progress.id,assessmentId:input.lessonId}});
      if(!prior&&rules.attemptLimit>0&&count>=rules.attemptLimit)throw new CourseError("ATTEMPT_LIMIT_REACHED",409);
      const correct=questions.filter((q,i)=>answerCorrect(q,input.answers![i])).length,score=correct/questions.length*100,success=score>=(isFinal?rules.finalScore:rules.quizScore);
      if(!prior)await tx.aiCourseAssessmentAttempt.create({data:{enrollmentId:progress.id,userId,versionId:version.id,assessmentId:input.lessonId,requestKey:key,answers:attemptAnswers,score,passed:success}});
      if(success){if(isFinal)finalPassed=true;else if(!passed.includes(input.lessonId))passed.push(input.lessonId);}
      result={correct,total:questions.length,score,passed:success,feedback:questions.map(q=>({...(q.type==="multipleChoice"?{correctIndex:q.correctIndex}:{}),explanation:q.explanation}))};
    }else if(input.action==="complete"){
      if(isFinal||!passed.includes(input.lessonId))throw new CourseError("PASS_LESSON_QUIZ_FIRST",409);
      if(!completed.includes(input.lessonId))completed.push(input.lessonId);
    }else if(input.action==="start"){
      const metadata=JSON.stringify({lessonId:input.lessonId,versionId:version.id});
      if(!await tx.auditLog.findFirst({where:{actorId:userId,action:"academy_lesson_started",targetId:progress.id,metadata}}))await tx.auditLog.create({data:{actorId:userId,action:"academy_lesson_started",targetId:progress.id,metadata}});
    }
    await tx.aiCourseProgress.update({where:{id:progress.id},data:{completed:JSON.stringify(completed),quizPassed:JSON.stringify(passed),finalPassed,lastActivityAt:new Date(),startedAt:progress.startedAt||new Date()}});
    const verified=await validateCompletion(tx,progress.id);
    const saved=await tx.aiCourseProgress.findUniqueOrThrow({where:{id:progress.id}});
    return {certificate:verified?.certificate,finalScore:verified?.score,progress:{...saved,progressPercent:progressPercent(saved,content,rules)},result};
  });
}
