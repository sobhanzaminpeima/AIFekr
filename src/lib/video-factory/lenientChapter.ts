import { chapterSchema, FactoryError, shotSchema } from "./domain";
import type { z } from "zod";

/**
 * Smaller writer models (e.g. Llama 70B on Workers AI) often return the chapter with
 * prose or code fences around it, wrapped in {"chapter": …}, with extra or renamed keys,
 * lower-case motion names, or cut off at the token limit. This turns such output into a
 * valid chapter when the content is there, instead of failing the whole production.
 */

/** Parses the first JSON object in text; repairs output cut off mid-way by closing it after the last complete element. */
export function extractJson(text: string): unknown {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  if (start < 0) throw new FactoryError("SCRIPT_FORMAT_INVALID", 502);
  const body = raw.slice(start);
  try { return JSON.parse(body.slice(0, body.lastIndexOf("}") + 1)); } catch { /* try repair below */ }
  // Walk back over closing braces and close whatever is still open after each one.
  let tries = 0;
  for (let i = body.length - 1; i > 0 && tries < 400; i--) {
    if (body[i] !== "}") continue;
    tries++;
    const prefix = body.slice(0, i + 1);
    const closers = closersFor(prefix);
    if (closers === null) continue;
    try { return JSON.parse(prefix + closers); } catch { /* keep walking back */ }
  }
  throw new FactoryError("SCRIPT_FORMAT_INVALID", 502);
}
/** The brackets needed to close a JSON prefix, or null when it ends inside a string. */
function closersFor(prefix: string): string | null {
  const stack: string[] = [];
  let inString = false, escaped = false;
  for (const c of prefix) {
    if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  return inString ? null : stack.reverse().join("");
}

const MOTIONS = ["STATIC", "PUSH_IN", "PAN", "TITLE", "CHART", "MAP"] as const;
const str = (v: unknown, max: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim().slice(0, max);
const pick = (o: Record<string, unknown>, ...keys: string[]) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };

/** Maps a loosely shaped chapter onto the strict schema: known keys only, safe IDs, valid motions. */
export function normalizeChapter(value: unknown, chapterIndex = 0): z.infer<typeof chapterSchema> {
  let v = value as Record<string, unknown>;
  if (v && typeof v === "object" && !Array.isArray(v) && !Array.isArray(v.shots)) {
    const inner = pick(v, "chapter", "Chapter", "data", "result");
    if (inner && typeof inner === "object") v = Array.isArray(inner) ? (inner[0] as Record<string, unknown>) : (inner as Record<string, unknown>);
    else if (Array.isArray(v.chapters) && v.chapters[0]) v = v.chapters[0] as Record<string, unknown>;
  }
  if (!v || typeof v !== "object") throw new FactoryError("SCRIPT_FORMAT_INVALID", 502);
  const rawShots = pick(v, "shots", "Shots", "scenes", "Scenes");
  if (!Array.isArray(rawShots) || !rawShots.length) throw new FactoryError("SCRIPT_FORMAT_INVALID", 502);
  const used = new Set<string>();
  const shots = rawShots.slice(0, 30).flatMap((item, i) => {
    if (!item || typeof item !== "object") return [];
    const s = item as Record<string, unknown>;
    let id = str(pick(s, "id", "shotId", "shot_id"), 64).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
    if (!id || used.has(id)) id = `c${chapterIndex + 1}-s${i + 1}`;
    while (used.has(id)) id = `${id}-x`;
    used.add(id);
    const narration = str(pick(s, "narration", "voiceover", "voice_over", "script", "text"), 3000);
    const visualPrompt = str(pick(s, "visualPrompt", "visual_prompt", "imagePrompt", "image_prompt", "prompt", "visual"), 2000);
    const title = str(pick(s, "title", "name", "heading"), 180) || (narration || visualPrompt).slice(0, 60) || `Shot ${i + 1}`;
    const motionRaw = str(pick(s, "motion", "camera", "cameraMotion"), 30).toUpperCase().replace(/[\s-]+/g, "_");
    let motion: (typeof MOTIONS)[number] = (MOTIONS as readonly string[]).includes(motionRaw) ? (motionRaw as (typeof MOTIONS)[number]) : motionRaw.includes("PAN") ? "PAN" : motionRaw.includes("STATIC") || motionRaw.includes("STILL") ? "STATIC" : "PUSH_IN";
    const out: Record<string, unknown> = { id, title, narration, visualPrompt, motion, notes: str(s.notes, 2000), revision: 0, sfxPrompt: str(pick(s, "sfxPrompt", "sfx"), 1000) };
    const dur = Number(pick(s, "durationSeconds", "duration", "seconds"));
    if (Number.isFinite(dur) && dur >= 0.5 && dur <= 600) out.durationSeconds = dur;
    for (const key of ["chart", "map", "animation"] as const) {
      if (s[key] === undefined) continue;
      const one = shotSchema.safeParse({ ...out, [key]: s[key] });
      if (one.success) out[key] = s[key];
    }
    if ((motion === "CHART" && !out.chart) || (motion === "MAP" && !out.map)) { motion = "PUSH_IN"; out.motion = motion; }
    const shot = shotSchema.safeParse(out);
    return shot.success ? [shot.data] : [];
  });
  const chapter = chapterSchema.safeParse({ title: str(pick(v, "title", "chapterTitle", "name"), 180) || `Chapter ${chapterIndex + 1}`, continuity: str(pick(v, "continuity", "notes", "summary"), 3000), shots });
  if (!chapter.success) throw new FactoryError("SCRIPT_FORMAT_INVALID", 502);
  return chapter.data;
}
