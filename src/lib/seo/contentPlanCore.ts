/**
 * Pure rules for blog automation: schedules, the topic queue, and which topic a
 * scheduled run writes about. No database or model access, so it is unit-tested.
 */
export type PlanFrequency = "daily" | "every3days" | "weekly" | "biweekly";
export type PlanMode = "draft" | "publish" | "hold";

const FREQ_DAYS: Record<PlanFrequency, number> = { daily: 1, every3days: 3, weekly: 7, biweekly: 14 };

export const isFrequency = (v: unknown): v is PlanFrequency => typeof v === "string" && v in FREQ_DAYS;
export const isMode = (v: unknown): v is PlanMode => v === "draft" || v === "publish" || v === "hold";

export function nextRunDate(frequency: string, from: Date): Date {
  const days = isFrequency(frequency) ? FREQ_DAYS[frequency] : 7;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export const MAX_TOPICS = 50;
export const MAX_TOPIC_LEN = 200;

/** One topic per line (or an array), trimmed, deduplicated, capped. Anything that is not a string is dropped. */
export function sanitizeTopics(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const topic = t.replace(/\s+/g, " ").trim().slice(0, MAX_TOPIC_LEN);
    const key = topic.toLowerCase();
    if (!topic || seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

export function parseTopics(json: string | null | undefined): string[] {
  try { return sanitizeTopics(JSON.parse(json || "[]")); } catch { return []; }
}

export interface TopicChoice {
  topic: string;
  /** True when the topic came off the queue (and must be removed after a successful run). */
  fromQueue: boolean;
  remaining: string[];
}

/**
 * The queue is written in order, one topic per run. When it is empty the run
 * falls back to the plan's theme, letting the idea agent pick a fresh angle
 * (told which titles already exist). No topics and no theme means nothing to do.
 */
export function chooseTopic(topics: string[], theme: string): TopicChoice | null {
  if (topics.length) return { topic: topics[0], fromQueue: true, remaining: topics.slice(1) };
  const t = theme.trim();
  return t ? { topic: t, fromQueue: false, remaining: [] } : null;
}

/** With no WordPress site connected, "draft"/"publish" cannot happen: keep the post in AiFekr instead of pretending. */
export function effectiveMode(mode: PlanMode, hasWordPress: boolean): PlanMode {
  return hasWordPress ? mode : "hold";
}

/** A run that has been "in flight" longer than this is assumed dead (server restart, crash). */
export const STALE_RUN_MS = 20 * 60 * 1000;
export const isRunStale = (runningSince: Date | null, now = Date.now()): boolean => !!runningSince && now - runningSince.getTime() > STALE_RUN_MS;
