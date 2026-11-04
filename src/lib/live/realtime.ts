import { WebSocket } from "undici";
import { prisma } from "@/lib/db/prisma";
import { PROVIDERS } from "@/lib/ai/providers";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { chargeAndLog, getAvailableCredits } from "@/lib/utils/teamCredits";
import { logError } from "@/lib/logging/errorLog";
import { LIVE_PROMPT, LiveError } from "./service";

/**
 * AIFekr Live, live mode: a full-duplex voice call with OpenAI GPT-Live,
 * relayed through this server. Browsers in Iran cannot reach OpenAI's media
 * servers directly (WebRTC failed in testing on 2026-11-03), but they reach
 * aifekr.com, and this server reaches OpenAI. So the browser POSTs short PCM
 * chunks (/api/live/realtime/audio) and listens to an event stream
 * (/api/live/realtime/events); this process holds the OpenAI WebSocket.
 *
 * Billing is per started minute from credits (Credit Rules
 * `live_realtime_minute`), charged at the start of each minute through
 * chargeAndLog, so usage and the credit ledger record every minute. A minute
 * is first claimed on the session row so it is never charged twice. When the
 * balance cannot cover the next minute, or the call reaches its length limit,
 * the assistant says one closing sentence and the call is closed; a call that
 * stops sending audio for 45 s (tab closed, network gone) is closed too.
 * Pilot (2026-11-03): GPT-Live answered Persian in 0.04-0.42 s; OpenAI bills
 * $0.05 per open minute.
 */
export const LIVE_REALTIME_MODEL = "gpt-live-1";
/** OpenAI's price for an open GPT-Live minute (developers.openai.com/api/docs/models/gpt-live-1, 2026-11-03). */
const PROVIDER_USD_PER_MINUTE = 0.05;
const TICK_MS = 5000, GOODBYE_MS = 7000, IDLE_MS = 45000, STALE_MS = 30000;
/** Audio the browser sends: 24 kHz mono 16-bit PCM, at most this many bytes per request (~2 s). */
export const MAX_AUDIO_CHUNK = 96000;

/**
 * `audience: "admins"` (the default) keeps live mode to admin accounts so the
 * owner can try it on the live site first; `"everyone"` opens it to all.
 * Stored in SiteSetting `liveRealtimeSettings`.
 */
export type RealtimeSettings = { enabled: boolean; audience: "admins" | "everyone"; maxMinutes: number; freeFirstMinute: boolean };
const DEFAULTS: RealtimeSettings = { enabled: true, audience: "admins", maxMinutes: 10, freeFirstMinute: true };
const openaiKey = () => PROVIDERS.find((p) => p.id === "openai-direct")?.apiKey || process.env.OPENAI_API_KEY || "";

export async function realtimeSettings(role?: string): Promise<RealtimeSettings & { creditsPerMinute: number }> {
  const [row, costs] = await Promise.all([prisma.siteSetting.findUnique({ where: { key: "liveRealtimeSettings" } }), getCreditCosts()]);
  let stored: Partial<RealtimeSettings> = {};
  try { stored = row ? JSON.parse(row.value) : {}; } catch { /* defaults */ }
  const s = { ...DEFAULTS, ...stored };
  return {
    enabled: s.enabled && process.env.LIVE_REALTIME_DISABLED !== "1" && !!openaiKey() && (s.audience === "everyone" || ["ADMIN", "SUPER_ADMIN"].includes(role ?? "")),
    audience: s.audience === "everyone" ? "everyone" : "admins",
    maxMinutes: Math.max(1, Math.min(60, Math.round(s.maxMinutes))),
    freeFirstMinute: !!s.freeFirstMinute,
    creditsPerMinute: costs.live_realtime_minute,
  };
}

/** Whether this account still has its one free first minute. */
export async function hasFreeMinute(userId: string) {
  return !(await prisma.liveVoiceSession.findFirst({ where: { userId, freeMinute: true }, select: { id: true } }));
}

/** Live-mode instructions: the AIFekr Live identity and tone, plus the visitor's language and the brand's spoken form (the pilot answered English in Persian and mispronounced the name). */
export function realtimeInstructions(lang: string) {
  const language = lang === "fa" ? "Persian (Farsi)" : lang === "de" ? "German" : lang === "tr" ? "Turkish" : "English";
  return `${LIVE_PROMPT}

Language for this call: the user's app is set to ${language}; start in ${language}. Whenever the user speaks another language, switch to that language immediately and keep answering in it (an English question gets an English answer).

Your name: in Persian say it as «ای آی فکر لایو» (ey-ey fekr laiv); in other languages say "A-I Fekr Live".

This is a live call: keep each answer short, stop talking when the user starts talking, and never read out symbols or lists.`;
}

/** What the browser's event stream receives. */
export type RelayEvent = { type: "audio"; data: string } | { type: "user" | "assistant"; delta: string } | { type: "closed"; reason: string };
type Relay = {
  id: string; userId: string; ws: WebSocket; startedAt: number; maxSeconds: number;
  lastInput: number; closing: boolean; ended: boolean;
  listeners: Set<(e: RelayEvent) => void>; backlog: RelayEvent[]; tick: ReturnType<typeof setInterval>;
};
const relays = new Map<string, Relay>();

function emit(r: Relay, e: RelayEvent) {
  if (r.listeners.size) r.listeners.forEach((l) => l(e));
  else if (r.backlog.length < 200) r.backlog.push(e); // before the stream attaches
}

/** Starts a live call: opens the OpenAI session, charges (or gives free) the first minute, and starts metering. */
export async function startRealtime(input: { userId: string; role: string; lang: string }) {
  const settings = await realtimeSettings(input.role);
  if (!settings.enabled) throw new LiveError("LIVE_REALTIME_UNAVAILABLE", 503);
  await sweepRealtime();
  if (await prisma.liveVoiceSession.findFirst({ where: { userId: input.userId, status: "ACTIVE" }, select: { id: true } })) throw new LiveError("LIVE_ALREADY_ACTIVE", 409);
  const free = settings.freeFirstMinute && await hasFreeMinute(input.userId);
  const available = await getAvailableCredits(input.userId);
  if (!free && available < settings.creditsPerMinute) throw new LiveError("INSUFFICIENT_CREDITS", 402, { required: settings.creditsPerMinute, available });

  const ws = new WebSocket("wss://api.openai.com/v1/live/sessions", { headers: { Authorization: `Bearer ${openaiKey()}` } });
  const providerSessionId = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LiveError("LIVE_REALTIME_FAILED", 502)), 15000);
    ws.onopen = () => ws.send(JSON.stringify({ type: "session.start", session: { model: LIVE_REALTIME_MODEL, instructions: realtimeInstructions(input.lang), audio: { format: { type: "audio/pcm", rate: 24000 } } } }));
    ws.onmessage = (m) => {
      try {
        const e = JSON.parse(String(m.data)) as { type?: string; session?: { id?: string } };
        if (e.type === "session.started" && e.session?.id) { clearTimeout(timer); resolve(e.session.id); }
        else if (e.type === "error") { clearTimeout(timer); reject(new LiveError("LIVE_REALTIME_FAILED", 502)); }
      } catch { /* not JSON */ }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new LiveError("LIVE_REALTIME_FAILED", 502)); };
  }).catch((e) => { try { ws.close(); } catch { /* closed */ } throw e; });

  const row = await prisma.liveVoiceSession.create({ data: { userId: input.userId, providerSessionId, freeMinute: free, creditsPerMinute: settings.creditsPerMinute, maxSeconds: settings.maxMinutes * 60 } });
  // The first minute is paid (or given free) before the user hears anything.
  if (!await chargeNextMinute(row.id)) {
    try { ws.send(JSON.stringify({ type: "session.close" })); ws.close(); } catch { /* closed */ }
    await finish(row.id, "insufficient_credits", null);
    throw new LiveError("INSUFFICIENT_CREDITS", 402, { required: settings.creditsPerMinute, available: await getAvailableCredits(input.userId) });
  }
  relay(row.id, input.userId, ws, settings.maxMinutes * 60);
  return { sessionId: row.id, creditsPerMinute: settings.creditsPerMinute, freeMinute: free, maxMinutes: settings.maxMinutes };
}

function relay(id: string, userId: string, ws: WebSocket, maxSeconds: number) {
  const r: Relay = { id, userId, ws, startedAt: Date.now(), maxSeconds, lastInput: Date.now(), closing: false, ended: false, listeners: new Set(), backlog: [], tick: setInterval(() => void meterTick(r), TICK_MS) };
  relays.set(id, r);
  let lastSeconds: number | null = null;
  ws.onmessage = (m) => {
    let e: { type?: string; delta?: string; usage?: { seconds?: number }; reason?: string };
    try { e = JSON.parse(String(m.data)); } catch { return; }
    if (typeof e.usage?.seconds === "number") lastSeconds = e.usage.seconds;
    if (e.type === "session.output_audio.delta" && e.delta) emit(r, { type: "audio", data: e.delta });
    else if (e.type === "session.input_transcript.delta" && e.delta) emit(r, { type: "user", delta: e.delta });
    else if (e.type === "session.output_transcript.delta" && e.delta) emit(r, { type: "assistant", delta: e.delta });
    else if (e.type === "session.closed") void end(r, e.reason || "closed", lastSeconds);
  };
  ws.onclose = () => void end(r, "provider_disconnected", lastSeconds);
  ws.onerror = () => { /* onclose follows */ };
}

/** Per-tick metering: heartbeat, idle and length limits, and the next minute's charge. */
async function meterTick(r: Relay) {
  if (r.closing || r.ended) return;
  try {
    const row = await prisma.liveVoiceSession.findUnique({ where: { id: r.id } });
    if (!row || row.status !== "ACTIVE") return void end(r, "closed", null);
    await prisma.liveVoiceSession.update({ where: { id: r.id }, data: { meteredAt: new Date() } });
    if (Date.now() - r.lastInput > IDLE_MS) return closeNow(r);
    const elapsed = (Date.now() - r.startedAt) / 1000;
    if (elapsed >= r.maxSeconds) return goodbye(r, "The call has reached its time limit. In the user's language, say one short, warm sentence that this call is ending now and they can start a new one, then stop.");
    if (Math.ceil(elapsed / 60) > row.chargedMinutes && !await chargeNextMinute(r.id))
      goodbye(r, "The user's credit has run out. In the user's language, say one short, warm sentence that the credit is finished and they can buy more credit to continue, then stop.");
  } catch (error) {
    await logError({ source: "live-realtime meter", error, userId: r.userId }).catch(() => {});
  }
}

function send(r: Relay, event: unknown) { try { r.ws.send(JSON.stringify(event)); return true; } catch { return false; } }
function closeNow(r: Relay) {
  if (r.ended) return;
  r.closing = true;
  if (!send(r, { type: "session.close" })) void end(r, "closed", null);
  setTimeout(() => void end(r, "closed", null), 15000);
}
function goodbye(r: Relay, sentence: string) {
  if (r.closing) return;
  r.closing = true;
  send(r, { type: "session.instructions.append", content: sentence });
  send(r, { type: "response.create" });
  setTimeout(() => { r.closing = false; closeNow(r); }, GOODBYE_MS);
}

async function end(r: Relay, reason: string, seconds: number | null) {
  if (r.ended) return;
  r.ended = true;
  clearInterval(r.tick);
  relays.delete(r.id);
  try { r.ws.close(); } catch { /* closed */ }
  emit(r, { type: "closed", reason });
  r.listeners.clear();
  // A minute that started after the last tick is still charged.
  const elapsed = seconds ?? Math.ceil((Date.now() - r.startedAt) / 1000);
  const row = await prisma.liveVoiceSession.findUnique({ where: { id: r.id } }).catch(() => null);
  if (row && row.status === "ACTIVE" && Math.ceil(elapsed / 60) > row.chargedMinutes) await chargeNextMinute(r.id).catch(() => false);
  await finish(r.id, reason, seconds).catch(() => {});
}

/**
 * Claims and charges the session's next started minute. The first minute of a
 * free session costs nothing. Returns false when the balance cannot pay it.
 */
export async function chargeNextMinute(id: string): Promise<boolean> {
  const row = await prisma.liveVoiceSession.findUnique({ where: { id } });
  if (!row || row.status !== "ACTIVE") return false;
  const minute = row.chargedMinutes + 1;
  const claim = await prisma.liveVoiceSession.updateMany({ where: { id, status: "ACTIVE", chargedMinutes: row.chargedMinutes }, data: { chargedMinutes: minute, meteredAt: new Date() } });
  if (!claim.count) return true; // already taken by a concurrent charge
  if (minute === 1 && row.freeMinute) return true;
  const paid = await chargeAndLog(row.userId, row.creditsPerMinute, {
    type: "tool", provider: "openai-live", model: LIVE_REALTIME_MODEL, mediaSeconds: 60, estimatedCostUsd: PROVIDER_USD_PER_MINUTE,
    requestId: `live-realtime:${id}:${minute}`, metadata: { feature: "live.realtime", sessionId: id, minute },
  });
  if (!paid) {
    await prisma.liveVoiceSession.updateMany({ where: { id, chargedMinutes: minute }, data: { chargedMinutes: minute - 1 } });
    return false;
  }
  await prisma.liveVoiceSession.update({ where: { id }, data: { chargedCredits: { increment: row.creditsPerMinute } } });
  return true;
}

async function finish(id: string, reason: string, seconds: number | null) {
  await prisma.liveVoiceSession.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "CLOSED", endReason: reason, seconds, endedAt: new Date() } });
}

function owned(userId: string, id: string) {
  const r = relays.get(id);
  if (!r || r.userId !== userId) throw new LiveError("SESSION_NOT_FOUND", 404);
  return r;
}

/** One chunk of the caller's microphone (24 kHz mono 16-bit PCM). */
export function pushAudio(userId: string, id: string, pcm: Uint8Array) {
  const r = owned(userId, id);
  if (pcm.length === 0 || pcm.length > MAX_AUDIO_CHUNK || pcm.length % 2) throw new LiveError("INVALID_AUDIO");
  r.lastInput = Date.now();
  if (!r.closing) send(r, { type: "session.input_audio.append", audio: Buffer.from(pcm).toString("base64") });
}

/** Whether this process is relaying the caller's call (the event stream answers 404 otherwise). */
export function hasRelay(userId: string, id: string) {
  return relays.get(id)?.userId === userId;
}

/** Subscribes the caller's event stream; returns the unsubscribe function. */
export function subscribe(userId: string, id: string, listener: (e: RelayEvent) => void) {
  const r = owned(userId, id);
  r.listeners.add(listener);
  for (const e of r.backlog.splice(0)) listener(e);
  return () => { r.listeners.delete(listener); };
}

/** Ends the user's call at their request. */
export async function closeRealtime(userId: string, id: string) {
  const r = relays.get(id);
  if (r && r.userId === userId) { closeNow(r); return { closed: true }; }
  const row = await prisma.liveVoiceSession.findFirst({ where: { id, userId } });
  if (!row) throw new LiveError("SESSION_NOT_FOUND", 404);
  if (row.status === "ACTIVE") { await closeProvider(row.providerSessionId); await finish(id, "user_closed", null); }
  return { closed: true };
}

/** Closes a provider session this process no longer holds (after a restart). */
async function closeProvider(providerSessionId: string) {
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(`wss://api.openai.com/v1/live/sessions/${encodeURIComponent(providerSessionId)}/attach`, { headers: { Authorization: `Bearer ${openaiKey()}` } });
    const done = () => { try { ws.close(); } catch { /* closed */ } resolve(); };
    const timer = setTimeout(done, 10000);
    ws.onopen = () => ws.send(JSON.stringify({ type: "session.close" }));
    ws.onmessage = (m) => { try { if (JSON.parse(String(m.data)).type === "session.closed") { clearTimeout(timer); done(); } } catch { /* ignore */ } };
    ws.onerror = () => { clearTimeout(timer); done(); };
  });
}

/** Calls whose relay is gone (the process restarted): close the provider side and the row. */
export async function sweepRealtime() {
  const stale = await prisma.liveVoiceSession.findMany({ where: { status: "ACTIVE", meteredAt: { lt: new Date(Date.now() - STALE_MS) } }, take: 20 });
  for (const row of stale) {
    if (relays.has(row.id)) continue;
    const claim = await prisma.liveVoiceSession.updateMany({ where: { id: row.id, status: "ACTIVE", meteredAt: row.meteredAt }, data: { meteredAt: new Date() } });
    if (!claim.count) continue;
    await closeProvider(row.providerSessionId);
    await finish(row.id, "relay_lost", null);
  }
}
let sweeper: ReturnType<typeof setInterval> | null = null;
export function ensureSweeper() {
  if (sweeper || process.env.VITEST) return;
  sweeper = setInterval(() => void sweepRealtime().catch(() => {}), 30000);
  sweeper.unref?.();
}
