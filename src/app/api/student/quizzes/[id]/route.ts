export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const quiz = await prisma.studentQuiz.findFirst({ where: { id: context.params.id, course: { userId: user.id } } });
  if (!quiz) return NextResponse.json({ error: "آزمون پیدا نشد" }, { status: 404 });
  const questions = JSON.parse(quiz.questions) as { question: string; topic: string; explanation: string; options: string[]; correctIndex: number }[];
  return NextResponse.json({ quiz: { ...quiz, questions: questions.map(({ correctIndex: _correctIndex, ...q }) => q) } });
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const quiz = await prisma.studentQuiz.findFirst({ where: { id: context.params.id, course: { userId: user.id } } });
  if (!quiz) return NextResponse.json({ error: "آزمون پیدا نشد" }, { status: 404 });
  let body: { answers?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const questions = JSON.parse(quiz.questions) as { topic: string; explanation: string; correctIndex: number }[];
  if (!Array.isArray(body.answers) || body.answers.length !== questions.length || body.answers.some((answer) => !Number.isInteger(answer) || Number(answer) < 0 || Number(answer) > 3)) {
    return NextResponse.json({ error: "پاسخ آزمون معتبر نیست" }, { status: 400 });
  }
  const answers = body.answers as number[];
  const score = answers.reduce((sum, answer, index) => sum + (answer === questions[index].correctIndex ? 1 : 0), 0);
  const weakTopics = questions.flatMap((question, index) => answers[index] === question.correctIndex ? [] : [question.topic]).filter(Boolean);
  const uniqueWeakTopics = Array.from(new Set(weakTopics));
  const attempt = await prisma.studentQuizAttempt.create({ data: { userId: user.id, quizId: quiz.id, answers: JSON.stringify(answers), score, total: questions.length, weakTopics: JSON.stringify(uniqueWeakTopics) } });
  return NextResponse.json({ attempt: { id: attempt.id, score, total: questions.length, weakTopics: uniqueWeakTopics, review: questions.map((question, index) => ({ correct: answers[index] === question.correctIndex, explanation: question.explanation, correctIndex: question.correctIndex })) } }, { status: 201 });
}
