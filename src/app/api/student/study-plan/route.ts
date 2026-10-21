export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { proposeStudySessions } from "@/lib/student/planner";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const lang = await getServerLang();
  const t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  let body: { examId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: t("درخواست نامعتبر است", "Invalid request", "Ungültige Anfrage", "Geçersiz istek") }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: t("درخواست نامعتبر است", "Invalid request", "Ungültige Anfrage", "Geçersiz istek") }, { status: 400 });
  if (typeof body.examId !== "string" || !body.examId) return NextResponse.json({ error: t("ابتدا امتحان را انتخاب کن", "Choose an exam first", "Zuerst eine Prüfung wählen", "Önce sınav seç") }, { status: 400 });
  const selectedExam = await prisma.studentExam.findFirst({ where: { id: body.examId, userId: user.id, examAt: { gt: new Date() } }, include: { course: { select: { name: true } } } });
  if (!selectedExam) return NextResponse.json({ error: t("امتحان پیدا نشد یا در گذشته است", "Exam not found or already in the past", "Prüfung nicht gefunden oder bereits vergangen", "Sınav bulunamadı veya tarihi geçmiş") }, { status: 404 });
  const exams = [selectedExam];
  const proposals = proposeStudySessions(exams.map((exam) => ({ id: exam.id, title: exam.title, courseId: exam.courseId, courseName: exam.course.name, examAt: exam.examAt })), new Date(), 7, lang);
  let created = 0;
  for (const session of proposals) {
    const dayStart = new Date(session.dueAt); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const dedupeKey = `${user.id}:${session.examId}:${session.courseId}:${dayStart.toISOString().slice(0, 10)}`;
    const exists = await prisma.studentTask.findUnique({ where: { dedupeKey }, select: { id: true } });
    if (exists) continue;
    try {
      await prisma.studentTask.create({ data: { userId: user.id, courseId: session.courseId, title: session.title, description: session.description, taskType: "study", dueAt: session.dueAt, generated: true, dedupeKey } });
      created += 1;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
    }
  }
  return NextResponse.json({ created, message: created ? t("برنامه ساخته شد؛ زمان جلسه‌ها قابل تغییر است", "Plan created; session times are editable", "Plan erstellt; Sitzungszeiten sind änderbar", "Plan oluşturuldu; oturum zamanları değiştirilebilir") : t("جلسهٔ جدیدی اضافه نشد؛ برنامهٔ موجود را ببین یا یک جلسه دستی اضافه کن", "No new sessions added; check your plan or add a manual session", "Keine neuen Sitzungen; Plan prüfen oder manuell ergänzen", "Yeni oturum eklenmedi; planı kontrol et veya elle ekle") });
}
