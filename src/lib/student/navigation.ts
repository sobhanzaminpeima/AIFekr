export const STUDENT_VIEWS = ["overview", "courses", "planner", "groups", "reports", "thesis", "profile", "business"] as const;
export type StudentView = typeof STUDENT_VIEWS[number];
export const STUDENT_TOOLS = ["upload", "notes", "practice", "review", "assignment"] as const;
export type StudentTool = typeof STUDENT_TOOLS[number];

export function readStudentNavigation(search: URLSearchParams) {
  const view = search.get("view");
  const tool = search.get("tool");
  return {
    view: STUDENT_VIEWS.includes(view as StudentView) ? view as StudentView : "overview" as StudentView,
    tool: STUDENT_TOOLS.includes(tool as StudentTool) ? tool as StudentTool : null,
    courseId: search.get("course") || "",
  };
}

export function studentViewHref(view: StudentView, courseId = "", tool?: StudentTool) {
  const query = new URLSearchParams({ view });
  if (courseId) query.set("course", courseId);
  if (tool) query.set("tool", tool);
  return `/student?${query}`;
}
