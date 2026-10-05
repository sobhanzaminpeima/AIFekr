import { prisma } from "@/lib/db/prisma";
import { parseCourseContent, courseLessons } from "./content";
import { randomUUID } from "node:crypto";
import { CourseError } from "./generation";

export async function publishedCourse(id: string) {
  const course = await prisma.aiCourse.findFirst({ where: { id, status: "PUBLISHED" } });
  if (!course?.content) throw new CourseError("COURSE_NOT_FOUND", 404);
  return { course, content: parseCourseContent(course.content) };
}
/** Stored learning activities are deterministic and NEVER invoke AI or credit charging. */
export async function saveCourseProgress(userId: string, courseId: string, input: { lessonId: string; action: "complete" | "quiz"; answers?: number[] }) {
  return prisma.$transaction(async tx => {
    const course = await tx.aiCourse.findFirst({ where: { id: courseId, status: "PUBLISHED" } });
    if (!course?.content) throw new CourseError("COURSE_NOT_FOUND", 404);
    const lessons = courseLessons(parseCourseContent(course.content));
    const lesson = lessons.find(item => item.id === input.lessonId);
    if (!lesson) throw new CourseError("LESSON_NOT_FOUND", 404);
    const progress = await tx.aiCourseProgress.upsert({ where: { userId_courseId_version: { userId, courseId, version: course.version } }, create: { userId, courseId, version: course.version }, update: {} });
    const completed: string[] = JSON.parse(progress.completed);
    const passed: string[] = JSON.parse(progress.quizPassed);
    let result;
    if (input.action === "quiz") {
      if (!Array.isArray(input.answers) || input.answers.length !== lesson.quiz.length || input.answers.some(answer => !Number.isInteger(answer) || answer < 0 || answer > 3)) throw new CourseError("ANSWER_ALL_QUESTIONS", 400);
      const correct = lesson.quiz.filter((q, index) => q.correctIndex === input.answers![index]).length;
      const success = correct / lesson.quiz.length >= 0.6;
      if (success && !passed.includes(lesson.id)) passed.push(lesson.id);
      result = { correct, total: lesson.quiz.length, passed: success, feedback: lesson.quiz.map(q => ({ correctIndex: q.correctIndex, explanation: q.explanation })) };
    } else {
      if (!passed.includes(lesson.id)) throw new CourseError("PASS_LESSON_QUIZ_FIRST", 409);
      if (!completed.includes(lesson.id)) completed.push(lesson.id);
    }
    const done = lessons.every(item => completed.includes(item.id));
    const name = done && !progress.completedAt ? (await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } })).name : null;
    const updated = await tx.aiCourseProgress.update({ where: { id: progress.id }, data: { completed: JSON.stringify(completed), quizPassed: JSON.stringify(passed), ...(done && !progress.completedAt ? { completedAt: new Date(), certificateId: randomUUID(), certificateTitle: course.title, certificateName: name || "AIFekr Student" } : {}) } });
    return { progress: updated, result };
  });
}
