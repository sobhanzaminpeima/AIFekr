import { z } from "zod";
import {assessmentSettings,academyQuestion,publicQuestion} from "./assessment";
export const courseBrief = z.object({ fieldOfStudy: z.string().trim().min(3).max(200), title: z.string().trim().min(3).max(200), description: z.string().trim().min(20).max(6000), language: z.enum(["fa", "en", "de", "tr"]) });

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const question = z.object({ question: text(10, 1200), options: z.array(text(1, 700)).length(4), correctIndex: z.number().int().min(0).max(3), explanation: text(10, 2000) });
export const learningBlockSchema = z.discriminatedUnion("type", [
  z.object({type:z.enum(["heading","paragraph","keyConcept","definition","example","codeExplanation","callout","warning","tip","quote","formula","reflection","summary"]),text:text(1,6000)}),
  z.object({type:z.literal("code"),code:text(1,12000),language:text(1,40)}),
  z.object({type:z.enum(["steps","flashcards"]),items:z.array(text(1,1000)).min(1).max(20)}),
  z.object({type:z.literal("table"),headers:z.array(text(1,100)).min(1).max(10),rows:z.array(z.array(text(1,500)).max(10)).max(30)}),
  z.object({type:z.enum(["image","resource","videoEmbed"]),url:z.string().url().refine(u=>u.startsWith("https://")),alt:text(1,500),caption:z.string().max(500).optional()}),
  z.object({type:z.enum(["interactiveExercise","knowledgeCheck","shortAnswerQuestion"]),prompt:text(1,2000),answer:text(1,2000)}),
]);
export const courseLessonSchema = z.object({ title: text(3, 200), content: text(200, 18000), blocks:z.array(learningBlockSchema).min(2).max(80).optional(), activity: text(30, 2500), quiz: z.array(question).min(1).max(6),assessmentQuestions:z.array(academyQuestion).min(1).max(30).optional(),assessmentSettings:assessmentSettings.optional() });
export const courseContentSchema = z.object({
  overview: text(30, 5000),
  objectives: z.array(text(10, 500)).min(3).max(15),
  chapters: z.array(z.object({
    title: text(3, 200),
    lessons: z.array(courseLessonSchema).min(1).max(8).refine(items=>new Set(items.map(l=>l.title.trim().toLowerCase())).size===items.length,"Duplicate lessons"),
  })).min(3).max(12).refine(items=>new Set(items.map(c=>c.title.trim().toLowerCase())).size===items.length,"Duplicate chapters"),
  finalProject: z.object({ title: text(3, 200), instructions: text(100, 5000), rubric: z.array(text(10, 700)).min(3).max(12) }),
  finalAssessment:z.array(question).min(3).max(30).optional(),
  finalAssessmentQuestions:z.array(academyQuestion).min(3).max(30).optional(),
  finalAssessmentSettings:assessmentSettings.optional(),
});
export type CourseContent = z.infer<typeof courseContentSchema>;
export const COURSE_CONTENT_LIMIT=4_000_000;
export function validateCourseContent(input:unknown){const parsed=courseContentSchema.parse(input);if(JSON.stringify(parsed).length>COURSE_CONTENT_LIMIT)throw Error("Course output too large");return parsed;}
export function parseCourseContent(raw: string): CourseContent {
  if (raw.length > COURSE_CONTENT_LIMIT) throw new Error("Course output too large");
  return validateCourseContent(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
}
export function courseLessons(content: CourseContent) {
  return content.chapters.flatMap((chapter, chapterIndex) => chapter.lessons.map((lesson, lessonIndex) => ({ ...lesson, id: `${chapterIndex}:${lessonIndex}`, chapter: chapter.title })));
}
/** Never send answer keys or provider metadata to the learning client. */
export function publicCourseContent(content: CourseContent) {
  return { ...content, finalAssessmentQuestions:content.finalAssessmentQuestions?.map(publicQuestion), finalAssessment:content.finalAssessment?.map(({question,options})=>({question,options})), chapters: content.chapters.map(chapter => ({ ...chapter, lessons: chapter.lessons.map(lesson => ({ ...lesson, assessmentQuestions:lesson.assessmentQuestions?.map(publicQuestion), quiz: lesson.quiz.map(({ question, options }) => ({ question, options })) })) })) };
}
