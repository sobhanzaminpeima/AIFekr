import { describe, expect, it } from "vitest";
import { scheduleFlashcardReview } from "@/lib/student/spacedRepetition";

describe("scheduleFlashcardReview", () => {
  const now = new Date("2026-09-30T12:00:00.000Z");
  it("schedules a harder card soon and does not lower mastery below zero", () => {
    const result = scheduleFlashcardReview(0, "hard", now);
    expect(result.masteryLevel).toBe(0);
    expect(result.nextReviewAt.toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });
  it("increases mastery and spaces easier cards farther apart", () => {
    const good = scheduleFlashcardReview(2, "good", now);
    const easy = scheduleFlashcardReview(2, "easy", now);
    expect(good.masteryLevel).toBe(3);
    expect(good.nextReviewAt.toISOString()).toBe("2026-10-07T12:00:00.000Z");
    expect(easy.masteryLevel).toBe(3);
    expect(easy.nextReviewAt.toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });
});
