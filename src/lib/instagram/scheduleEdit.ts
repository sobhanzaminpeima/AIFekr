/**
 * Editing a queued post (roadmap E8): only a post still waiting may change,
 * a new time must be in the future, auto mode keeps its plan and media rules,
 * and a media link must be a public https address Instagram can fetch.
 */
export type EditError = "NOT_PENDING" | "PAST_TIME" | "INVALID_TIME" | "EMPTY_CAPTION" | "AUTO_NOT_IN_PLAN" | "AUTO_NEEDS_MEDIA" | "MEDIA_NOT_PUBLIC";

type Post = { status: string; mode: string; imageUrl: string | null; videoUrl: string | null };
type Body = { caption?: unknown; hashtags?: unknown; imageUrl?: unknown; videoUrl?: unknown; scheduledFor?: unknown; mode?: unknown };

const publicHttps = (v: string) => { try { return new URL(v).protocol === "https:"; } catch { return false; } };

export function scheduleEdit(post: Post, body: Body, canAuto: boolean, now = Date.now()): { ok: true; data: Record<string, unknown> } | { ok: false; error: EditError } {
  if (post.status !== "PENDING") return { ok: false, error: "NOT_PENDING" };
  const data: Record<string, unknown> = {};
  if (body.caption !== undefined) {
    const caption = String(body.caption ?? "").trim();
    if (!caption) return { ok: false, error: "EMPTY_CAPTION" };
    data.caption = caption.slice(0, 2200);
  }
  if (body.hashtags !== undefined) data.hashtags = (Array.isArray(body.hashtags) ? body.hashtags.join(" ") : String(body.hashtags ?? "")).slice(0, 500);
  for (const key of ["imageUrl", "videoUrl"] as const) {
    if (body[key] === undefined) continue;
    const value = String(body[key] ?? "").trim();
    if (value && !publicHttps(value)) return { ok: false, error: "MEDIA_NOT_PUBLIC" };
    data[key] = value || null;
  }
  if (body.scheduledFor !== undefined) {
    const at = new Date(String(body.scheduledFor));
    if (Number.isNaN(at.getTime())) return { ok: false, error: "INVALID_TIME" };
    if (at.getTime() <= now) return { ok: false, error: "PAST_TIME" };
    data.scheduledFor = at;
  }
  if (body.mode !== undefined) data.mode = body.mode === "auto" ? "auto" : "manual";
  const mode = (data.mode as string | undefined) ?? post.mode;
  if (mode === "auto") {
    if (!canAuto) return { ok: false, error: "AUTO_NOT_IN_PLAN" };
    const image = data.imageUrl !== undefined ? data.imageUrl : post.imageUrl;
    const video = data.videoUrl !== undefined ? data.videoUrl : post.videoUrl;
    if (!image && !video) return { ok: false, error: "AUTO_NEEDS_MEDIA" };
  }
  return { ok: true, data };
}
