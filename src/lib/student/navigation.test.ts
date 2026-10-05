import { describe, expect, it } from "vitest";
import { readStudentNavigation, studentViewHref } from "./navigation";

describe("student feature deep links", () => {
  it("preserves course and feature when reopening a shared URL", () => {
    const href = studentViewHref("courses", "my/course&name", "practice");
    expect(readStudentNavigation(new URL(href, "https://aifekr.test").searchParams)).toEqual({ view: "courses", courseId: "my/course&name", tool: "practice" });
  });
  it("limits navigation to known views and tools", () => {
    expect(readStudentNavigation(new URLSearchParams("view=admin&tool=delete"))).toEqual({ view: "overview", tool: null, courseId: "" });
  });
  it("opens the selected student tab without requiring a course", () => {
    expect(readStudentNavigation(new URLSearchParams("view=planner")).view).toBe("planner");
    expect(studentViewHref("profile")).toBe("/student?view=profile");
  });
});
