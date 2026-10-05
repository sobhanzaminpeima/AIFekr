import { z } from "zod";
export const courseBrief = z.object({ fieldOfStudy: z.string().trim().min(3).max(200), title: z.string().trim().min(3).max(200), description: z.string().trim().min(20).max(6000), language: z.enum(["fa", "en", "de", "tr"]) });

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const question = z.object({ question: text(10, 1200), options: z.array(text(1, 700)).length(4), correctIndex: z.number().int().min(0).max(3), explanation: text(10, 2000) });
export const courseLessonSchema = z.object({ title: text(3, 200), content: text(200, 18000), activity: text(30, 2500), quiz: z.array(question).min(1).max(6) });
export const courseContentSchema = z.object({
  overview: text(30, 5000),
  objectives: z.array(text(10, 500)).min(3).max(15),
  chapters: z.array(z.object({
    title: text(3, 200),
    lessons: z.array(courseLessonSchema).min(1).max(8),
  })).min(3).max(12),
  finalProject: z.object({ title: text(3, 200), instructions: text(100, 5000), rubric: z.array(text(10, 700)).min(3).max(12) }),
});
export type CourseContent = z.infer<typeof courseContentSchema>;
export function parseCourseContent(raw: string): CourseContent {
  if (raw.length > 500000) throw new Error("Course output too large");
  return courseContentSchema.parse(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
}
export function courseLessons(content: CourseContent) {
  return content.chapters.flatMap((chapter, chapterIndex) => chapter.lessons.map((lesson, lessonIndex) => ({ ...lesson, id: `${chapterIndex}:${lessonIndex}`, chapter: chapter.title })));
}
/** Never send answer keys or provider metadata to the learning client. */
export function publicCourseContent(content: CourseContent) {
  return { ...content, chapters: content.chapters.map(chapter => ({ ...chapter, lessons: chapter.lessons.map(lesson => ({ ...lesson, quiz: lesson.quiz.map(({ question, options }) => ({ question, options })) })) })) };
}
