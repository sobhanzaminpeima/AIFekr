import { describe, expect, it } from "vitest";
import { dayKey, earnedBadges, latestActivity, studyStreak } from "./insights";

describe("studyStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(studyStreak(["2026-11-22", "2026-11-23", "2026-11-24"], "2026-11-24")).toBe(3);
  });
  it("keeps a streak alive when today has no study yet", () => {
    expect(studyStreak(["2026-11-22", "2026-11-23"], "2026-11-24")).toBe(2);
  });
  it("breaks on a missed day", () => {
    expect(studyStreak(["2026-11-20", "2026-11-22", "2026-11-23"], "2026-11-24")).toBe(2);
    expect(studyStreak(["2026-11-21"], "2026-11-24")).toBe(0);
  });
  it("crosses month and leap-day boundaries", () => {
    expect(studyStreak(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01")).toBe(3);
  });
});

describe("dayKey", () => {
  it("uses the student's time zone", () => {
    const late = new Date("2026-11-24T22:30:00Z");
    expect(dayKey(late, "UTC")).toBe("2026-11-24");
    expect(dayKey(late, "Asia/Tehran")).toBe("2026-11-25");
  });
  it("rejects an invalid zone", () => {
    expect(() => dayKey(new Date(), "Not/AZone")).toThrow();
  });
});

describe("earnedBadges", () => {
  it("awards only what the data supports", () => {
    const b = earnedBadges({ courses: 1, materials: 4, quizAttempts: 1, bestQuizPercent: 90, reviewedCards: 19, streak: 3, groups: 0 });
    expect(b).toMatchObject({ first_course: true, five_sources: false, first_quiz: true, quiz_ace: true, card_reviewer: false, streak_3: true, streak_7: false, group_member: false });
  });
});

describe("latestActivity", () => {
  it("returns newest first, capped", () => {
    const items = ["2026-11-01", "2026-11-03", "2026-11-02"].map((d, i) => ({ kind: "note" as const, title: String(i), at: d + "T00:00:00.000Z" }));
    expect(latestActivity(items, 2).map((i) => i.title)).toEqual(["1", "2"]);
  });
});
