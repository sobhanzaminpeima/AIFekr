import { describe, expect, it } from "vitest";
import { scheduleEdit } from "./scheduleEdit";

const now = new Date("2026-11-15T10:00:00Z").getTime();
const pending = { status: "PENDING", mode: "manual", imageUrl: "https://cdn.aifekr.com/a.jpg", videoUrl: null };

describe("editing a queued post", () => {
  it("moves a waiting post to a new future time (drag on the calendar)", () => {
    const r = scheduleEdit(pending, { scheduledFor: "2026-11-20T09:00:00Z" }, false, now);
    expect(r).toEqual({ ok: true, data: { scheduledFor: new Date("2026-11-20T09:00:00Z") } });
  });
  it("refuses a past time and a post that already went out", () => {
    expect(scheduleEdit(pending, { scheduledFor: "2026-11-01T09:00:00Z" }, false, now)).toEqual({ ok: false, error: "PAST_TIME" });
    expect(scheduleEdit({ ...pending, status: "PUBLISHED" }, { caption: "x" }, false, now)).toEqual({ ok: false, error: "NOT_PENDING" });
  });
  it("keeps the plan and media rules for automatic publishing", () => {
    expect(scheduleEdit(pending, { mode: "auto" }, false, now)).toEqual({ ok: false, error: "AUTO_NOT_IN_PLAN" });
    expect(scheduleEdit({ ...pending, imageUrl: null }, { mode: "auto" }, true, now)).toEqual({ ok: false, error: "AUTO_NEEDS_MEDIA" });
    expect(scheduleEdit(pending, { mode: "auto" }, true, now).ok).toBe(true);
  });
  it("accepts only a public https media link Instagram can fetch", () => {
    expect(scheduleEdit(pending, { imageUrl: "data:image/png;base64,AAA" }, false, now)).toEqual({ ok: false, error: "MEDIA_NOT_PUBLIC" });
    expect(scheduleEdit(pending, { imageUrl: "" }, false, now)).toEqual({ ok: true, data: { imageUrl: null } });
  });
  it("never empties the caption", () => {
    expect(scheduleEdit(pending, { caption: "  " }, false, now)).toEqual({ ok: false, error: "EMPTY_CAPTION" });
  });
});
