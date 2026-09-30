export interface ExamForPlanning {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  examAt: Date;
}

/**
 * Proposes editable 30-minute review sessions on the coming days before each
 * exam. This is a transparent deadline-based heuristic, not an AI prediction.
 */
export function proposeStudySessions(exams: ExamForPlanning[], now = new Date(), horizonDays = 7) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const proposed: { courseId: string; title: string; description: string; dueAt: Date }[] = [];
  const seen = new Set<string>();

  for (const exam of exams) {
    for (let offset = 0; offset < horizonDays; offset += 1) {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() + offset);
      day.setUTCHours(18, 0, 0, 0);
      if (day >= exam.examAt) continue;
      const key = `${exam.courseId}:${day.toISOString().slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      proposed.push({
        courseId: exam.courseId,
        title: `Review for ${exam.title}`.slice(0, 200),
        description: `30-minute review session for ${exam.courseName}. Suggested from the exam date; edit or delete as needed.`,
        dueAt: day,
      });
    }
  }
  return proposed.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
