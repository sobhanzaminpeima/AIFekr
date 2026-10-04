import { describe, expect, it } from "vitest";
import { proposeStudySessions } from "@/lib/student/planner";

describe("proposeStudySessions", () => {
  const now = new Date("2026-09-30T10:00:00.000Z");

  it("never proposes a session earlier than the current time", () => {
    const late = new Date("2026-09-30T20:00:00.000Z");
    const sessions = proposeStudySessions([{ id: "future", title: "Final", courseId: "c", courseName: "Biology", examAt: new Date("2026-10-10T10:00:00Z") }], late);
    expect(sessions.length).toBe(6);
    expect(sessions.every((session) => session.dueAt > late)).toBe(true);
  });

  it("creates editable review sessions only before the exam within the horizon", () => {
    const sessions = proposeStudySessions([{
      id: "exam-1", title: "Midterm", courseId: "course-1", courseName: "Economics",
      examAt: new Date("2026-10-04T09:00:00.000Z"),
    }], now);
    expect(sessions.map((session) => session.dueAt.toISOString())).toEqual([
      "2026-09-30T18:00:00.000Z", "2026-10-01T18:00:00.000Z", "2026-10-02T18:00:00.000Z", "2026-10-03T18:00:00.000Z",
    ]);
  });

  it("keeps sessions attached to each exam even when exams share a course and day", () => {
    const sessions = proposeStudySessions([
      { id: "exam-1", title: "Midterm", courseId: "course-1", courseName: "Economics", examAt: new Date("2026-10-02T09:00:00.000Z") },
      { id: "exam-2", title: "Final", courseId: "course-1", courseName: "Economics", examAt: new Date("2026-10-05T09:00:00.000Z") },
    ], now);
    expect(sessions).toHaveLength(7);
    expect(new Set(sessions.map((session) => session.examId))).toEqual(new Set(["exam-1", "exam-2"]));
    expect(sessions.every((session) => session.dueAt < new Date("2026-10-05T09:00:00.000Z"))).toBe(true);
  });
});
