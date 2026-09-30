export type FlashcardRating = "hard" | "good" | "easy";

export function scheduleFlashcardReview(currentLevel: number, rating: FlashcardRating, now = new Date()) {
  const level = Math.max(0, Math.min(4, Math.floor(currentLevel)));
  const intervals = rating === "hard" ? [1, 1, 2, 3, 5] : rating === "good" ? [1, 3, 7, 14, 30] : [3, 7, 14, 30, 60];
  const nextLevel = rating === "hard" ? Math.max(0, level - 1) : Math.min(5, level + 1);
  const days = intervals[level];
  const nextReviewAt = new Date(now);
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + days);
  return { masteryLevel: nextLevel, nextReviewAt };
}
