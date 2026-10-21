export interface ExamForPlanning {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  examAt: Date;
}

type PlannerLang = "fa" | "en" | "de" | "tr";

/**
 * Proposes editable 30-minute review sessions on the coming days before each
 * exam. This is a transparent deadline-based heuristic, not an AI prediction.
 */
export function proposeStudySessions(exams: ExamForPlanning[], now = new Date(), horizonDays = 7, lang: PlannerLang = "fa") {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const proposed: { examId: string; courseId: string; title: string; description: string; dueAt: Date }[] = [];
  const seen = new Set<string>();

  for (const exam of exams) {
    for (let offset = 0; offset < horizonDays; offset += 1) {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() + offset);
      day.setUTCHours(18, 0, 0, 0);
      if (day <= now || day >= exam.examAt) continue;
      const key = `${exam.id}:${day.toISOString().slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      proposed.push({
        examId: exam.id,
        courseId: exam.courseId,
        title: (lang === "en" ? `Review for: ${exam.title}` : lang === "de" ? `Wiederholung: ${exam.title}` : lang === "tr" ? `Sınav tekrarı: ${exam.title}` : `مرور امتحان: ${exam.title}`).slice(0, 200),
        description: lang === "en" ? `30-minute review for ${exam.courseName}, focused on the exam “${exam.title}”. Suggested; editable or deletable.`
          : lang === "de" ? `30-minütige Wiederholung für ${exam.courseName}, passend zur Prüfung „${exam.title}“. Vorschlag; bearbeitbar oder löschbar.`
            : lang === "tr" ? `${exam.courseName} dersi ve “${exam.title}” sınavı için 30 dakikalık tekrar. Öneridir; düzenlenebilir veya silinebilir.`
              : `جلسهٔ ۳۰ دقیقه‌ای برای درس ${exam.courseName} و امتحان «${exam.title}». پیشنهادی و قابل ویرایش یا حذف است.`,
        dueAt: day,
      });
    }
  }
  return proposed.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
