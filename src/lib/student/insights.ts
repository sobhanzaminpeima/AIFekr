/**
 * Student progress signals derived from data the workspace already stores
 * (no extra tables): study streak, earned badges and a recent-activity feed.
 */

export type StudentBadgeId = "first_course" | "five_sources" | "first_quiz" | "quiz_ace" | "card_reviewer" | "streak_3" | "streak_7" | "group_member";

export const STUDENT_BADGES: StudentBadgeId[] = ["first_course", "five_sources", "first_quiz", "quiz_ace", "card_reviewer", "streak_3", "streak_7", "group_member"];

/** YYYY-MM-DD for `date` in `timeZone` (throws RangeError on an invalid zone). */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function previousDay(key: string): string {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive study days ending today, or ending yesterday when the student
 * has not studied yet today (the streak is still alive until the day ends).
 */
export function studyStreak(studyDays: Iterable<string>, today: string): number {
  const days = new Set(studyDays);
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

export interface BadgeInput {
  courses: number;
  materials: number;
  quizAttempts: number;
  bestQuizPercent: number;
  reviewedCards: number;
  streak: number;
  groups: number;
}

export function earnedBadges(input: BadgeInput): Record<StudentBadgeId, boolean> {
  return {
    first_course: input.courses >= 1,
    five_sources: input.materials >= 5,
    first_quiz: input.quizAttempts >= 1,
    quiz_ace: input.bestQuizPercent >= 90,
    card_reviewer: input.reviewedCards >= 20,
    streak_3: input.streak >= 3,
    streak_7: input.streak >= 7,
    group_member: input.groups >= 1,
  };
}

export type ActivityKind = "material" | "note" | "quiz" | "flashcards" | "session";
export interface ActivityItem { kind: ActivityKind; title: string; at: string }

export function latestActivity(items: ActivityItem[], limit = 8): ActivityItem[] {
  return [...items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
