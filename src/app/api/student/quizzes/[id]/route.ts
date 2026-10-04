export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { verify } from "jsonwebtoken";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const quiz = await prisma.studentQuiz.findFirst({ where: { id: context.params.id, course: { userId: user.id } } });
  if (!quiz) return NextResponse.json({ error: "آزمون پیدا نشد" }, { status: 404 });
  const questions = JSON.parse(quiz.questions) as { question: string; topic: string; explanation: string; options: string[]; correctIndex: number }[];
  return NextResponse.json({ quiz: { ...quiz, questions: questions.map((question) => ({ question: question.question, topic: question.topic, explanation: question.explanation, options: question.options })) } });
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const quiz = await prisma.studentQuiz.findFirst({ where: { id: context.params.id, course: { userId: user.id } } });
  if (!quiz) return NextResponse.json({ error: "آزمون پیدا نشد" }, { status: 404 });
  if (quiz.timeLimitSeconds) {
    const previousAttempt = await prisma.studentQuizAttempt.findFirst({ where: { userId: user.id, quizId: quiz.id }, select: { id: true } });
    if (previousAttempt) return NextResponse.json({ error: "این آزمون قبلاً ثبت شده است" }, { status: 409 });
  }
  let body: { answers?: unknown; attemptToken?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const questions = JSON.parse(quiz.questions) as { topic: string; explanation: string; correctIndex: number }[];
  if (!Array.isArray(body.answers) || body.answers.length !== questions.length || body.answers.some((answer) => answer !== null && (!Number.isInteger(answer) || Number(answer) < 0 || Number(answer) > 3))) {
    return NextResponse.json({ error: "پاسخ آزمون معتبر نیست" }, { status: 400 });
  }
  let startedAt = new Date();
  if (quiz.timeLimitSeconds) {
    try {
      const token = verify(body.attemptToken || "", process.env.JWT_SECRET!) as { kind?: string; quizId?: string; userId?: string; iat?: number };
      if (token.kind !== "student_quiz" || token.quizId !== quiz.id || token.userId !== user.id || !token.iat) throw new Error("invalid token");
      startedAt = new Date(token.iat * 1000);
      if (Date.now() - startedAt.getTime() > quiz.timeLimitSeconds * 1000 + 30_000) return NextResponse.json({ error: "زمان آزمون به پایان رسیده است" }, { status: 410 });
    } catch {
      return NextResponse.json({ error: "توکن شروع آزمون معتبر نیست یا منقضی شده است" }, { status: 403 });
    }
  }
  const answers = body.answers as (number | null)[];
  const score = answers.reduce<number>((sum, answer, index) => sum + (answer !== null && answer === questions[index].correctIndex ? 1 : 0), 0);
  const weakTopics = questions.flatMap((question, index) => answers[index] !== null && answers[index] === question.correctIndex ? [] : [question.topic]).filter(Boolean);
  const uniqueWeakTopics = Array.from(new Set(weakTopics));
  let attempt;
  try {
    attempt = await prisma.studentQuizAttempt.create({ data: { userId: user.id, quizId: quiz.id, answers: JSON.stringify(answers), score, total: questions.length, weakTopics: JSON.stringify(uniqueWeakTopics), startedAt, attemptToken: quiz.timeLimitSeconds ? body.attemptToken : null } });
  } catch {
    return NextResponse.json({ error: "آزمون قبلاً ثبت شده یا ذخیره‌سازی ناموفق بود" }, { status: 409 });
  }
  return NextResponse.json({ attempt: { id: attempt.id, score, total: questions.length, weakTopics: uniqueWeakTopics, review: questions.map((question, index) => ({ correct: answers[index] !== null && answers[index] === question.correctIndex, explanation: question.explanation, correctIndex: question.correctIndex })) } }, { status: 201 });
}
