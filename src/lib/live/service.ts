import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { PROVIDERS, type Provider } from "@/lib/ai/providers";
import { routedStreamChat } from "@/lib/ai/router";
import { estimateCostUsd } from "@/lib/ai/costEstimator";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { chargeAndLog, getAvailableCredits, refundCredits } from "@/lib/utils/teamCredits";
import { voicePolicy, voiceCredentials } from "@/lib/voice-studio/config";
import { synthesize } from "@/lib/voice-studio/provider";
import type { SpeechCatalog } from "@/lib/voice-studio/provider";

/**
 * AIFekr Live: a spoken conversation with the assistant. One turn is
 * speech -> text (OpenAI transcription), an answer from the chat router, and
 * that answer read aloud by ElevenLabs. Nothing is stored except the usual
 * usage and ledger rows; the conversation itself stays in the browser.
 *
 * Charging: the balance is checked before any provider is called, the turn is
 * charged once the answer's length (and so its speech cost) is known, and the
 * charge is refunded if the speech then fails. Prices are admin-editable
 * Credit Rules: `live_turn` per turn (transcription + answer) plus
 * `live_tts_100` per started 100 characters spoken.
 */

/** ElevenLabs' low-latency model that also speaks Persian (eleven_flash_v2_5 does not). */
export const LIVE_TTS_MODEL = "eleven_v4_turbo";
/**
 * The model that answers. The chat router picks by message type and, on this
 * server, fell back to a small model that handled Persian badly; Live always
 * starts with OpenAI (LIVE_MODEL, else OPENAI_MODEL) and only falls back if it fails.
 */
const liveModel = () => process.env.LIVE_MODEL || PROVIDERS.find((p) => p.id === "openai-direct")?.model;
/** Answers are spoken, so they are kept short; a longer one is cut at a sentence end. */
export const LIVE_MAX_REPLY_CHARS = 450;
export const LIVE_MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/wav", "audio/x-wav"]);

/** ElevenLabs' premade conversational voices, offered when the account's catalog has them. */
/** AIFekr Live's two voices: Fika (female) and Fiko (male), in both modes (live mode: realtime.ts LIVE_REALTIME_VOICES). */
const LIVE_VOICES = [
  { id: "cgSgspJ2msm6clMCkdW9", key: "fika", name: "Fika", gender: "female" },
  { id: "cjVigY5qzO86Huf0OWal", key: "fiko", name: "Fiko", gender: "male" },
] as const;

export class LiveError extends Error {
  constructor(public code: string, public status = 400, public extra: Record<string, unknown> = {}) { super(code); }
}

export const LIVE_PROMPT = `You are AIFekr Live, the real-time voice assistant of AIFekr (aifekr.com), an AI platform for chat, content creation, business and study tools. You are speaking out loud with the user.

Identity: if asked who or what you are, or how you work, answer plainly: you are AIFekr Live, AIFekr's voice assistant; the user's voice is turned into text, an AI language model chosen by AIFekr writes your answer, and a speech engine reads it aloud. Never claim to be another company's product, never invent a model name, and never say you don't know what you are.

Style: this is a spoken conversation between friends, not an essay. Answer in one or two short sentences (about 35 words at most) unless the user asks for detail or a step-by-step answer. No markdown, lists, headings, emoji, links or code. Be warm, curious and natural; you may ask one short follow-up question.

Language: reply entirely in the language the user just spoke. In Persian, always use everyday spoken (colloquial, Tehrani) Persian the way people actually talk, e.g. «می‌خوای»، «چیکار کنیم»، «یه کم»، «نگران نباش», never formal written or bookish Persian.

Never repeat yourself: do not repeat an earlier answer or reuse the same opening. If the user asks again about something you already answered, add something new or ask what they want to know more about. If the transcript looks empty, garbled or cut off, don't guess or comment on which language it is; just say briefly that you didn't catch it and ask them to say it again.

Topics: anything on the user's mind: feelings and a bad day, relationships, health habits, study, work, money, ideas, business questions, general knowledge, small talk. Never say you can only help with one area. When someone is having a hard time, listen first and be kind and practical; for a medical, legal or mental-health emergency, gently suggest a professional or local emergency help. When you mention AIFekr, describe only what it really offers: AI chat, image, video and music generation, Voice Studio, Video Factory, CRM, accounting, SEO, social media tools, and student and fitness workspaces; usage is paid with credits.`;

export type LiveHistory = { role: "user" | "assistant"; content: string }[];

export async function liveCosts() {
  const costs = await getCreditCosts();
  return { turn: costs.live_turn, per100: costs.live_tts_100 };
}
export const turnCredits = (chars: number, c: { turn: number; per100: number }) => c.turn + c.per100 * Math.ceil(Math.max(1, chars) / 100);

async function liveVoices() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "voiceStudioCatalog" } });
  const ids = row ? new Set((JSON.parse(row.value) as SpeechCatalog).voices.map((v) => v.id)) : null;
  return LIVE_VOICES.filter((v) => !ids || ids.has(v.id));
}

/** What the screen needs before the first turn: availability, voices, price and balance. */
export async function liveBootstrap(userId: string, withRealtime = true) {
  const [policy, voices, costs, credits] = await Promise.all([voicePolicy(), liveVoices(), liveCosts(), getAvailableCredits(userId)]);
  let speech = policy.enabled;
  if (speech) await voiceCredentials().catch(() => { speech = false; });
  const transcription = !!PROVIDERS.find((p) => p.id === "openai-direct")?.apiKey;
  // Live mode (GPT-Live, per minute) next to the turn-by-turn mode.
  const realtime = withRealtime ? await (async () => {
    const { realtimeSettings, hasFreeMinute, ensureSweeper } = await import("./realtime");
    ensureSweeper();
    const role = (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role;
    const s = await realtimeSettings(role);
    return { enabled: s.enabled, creditsPerMinute: s.creditsPerMinute, maxMinutes: s.maxMinutes, freeMinute: s.freeFirstMinute && await hasFreeMinute(userId) };
  })() : null;
  return { enabled: speech && transcription && voices.length > 0, voices, costs, credits, typicalTurn: turnCredits(200, costs), realtime };
}

async function transcribe(audio: File, lang: string): Promise<string> {
  const provider = PROVIDERS.find((p) => p.id === "openai-direct")!;
  const body = new FormData();
  // The extension is how the provider reads the format: an iPhone recording is mp4 even if a page named it .webm.
  const type = audio.type.split(";")[0];
  const ext = /mp4|m4a|aac/.test(type) ? "mp4" : /ogg/.test(type) ? "ogg" : /mpeg/.test(type) ? "mp3" : /wav/.test(type) ? "wav" : "webm";
  body.set("file", audio, `speech.${ext}`);
  body.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  body.set("response_format", "json");
  // A hint, not a forced language: a visitor whose site language differs from what they speak must still be understood.
  body.set("prompt", lang === "fa" ? "گفتگوی روزمره به فارسی محاوره‌ای." : "Everyday conversation.");
  const res = await fetch(`${provider.baseURL}/audio/transcriptions`, { method: "POST", body, headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new LiveError("TRANSCRIPTION_FAILED", 502);
  const text = String(((await res.json()) as { text?: string }).text ?? "").trim();
  if (!text) throw new LiveError("NO_SPEECH", 422);
  return text.slice(0, 2000);
}

/** Spoken form of an answer: no markdown symbols, cut at a sentence end within the limit. */
export function spokenReply(text: string, max = LIVE_MAX_REPLY_CHARS): string {
  const clean = text.replace(/<SUGGESTIONS>[\s\S]*?<\/SUGGESTIONS>/g, "").replace(/[*#`_>|~]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max), end = Math.max(...[".", "!", "?", "؟", "。"].map((p) => cut.lastIndexOf(p)));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut).trim();
}

/**
 * Provider cost of a turn in USD, or null when the speech price is not configured.
 * `unit` is USD per 1,000 billed ElevenLabs credits (Voice Studio's modelUsdPer1k);
 * Turbo models bill about half a credit per character, so the billed count from the
 * response is used when present and the character count (an upper bound) otherwise.
 */
export function liveCostUsd(llmUsd: number | null, unit: number | undefined, characters: number, billed: number | null): number | null {
  if (unit === undefined) return null;
  return ((billed ?? characters) * unit) / 1000 + (llmUsd ?? 0);
}

/** An answer split into at most 3 speakable parts at sentence ends (each part is synthesized in parallel). */
export function speechParts(reply: string, maxParts = 3): string[] {
  const sentences = reply.match(/[^.!?؟。]+[.!?؟。]*\s*/g)?.map((x) => x.trim()).filter(Boolean) ?? [reply];
  if (sentences.length <= maxParts) return sentences;
  const size = Math.ceil(sentences.length / maxParts), out: string[] = [];
  for (let i = 0; i < sentences.length; i += size) out.push(sentences.slice(i, i + size).join(" "));
  return out;
}

/** ElevenLabs language code for the answer: Persian when it is written in Persian script, else the visitor's language. */
export const speechLanguage = (reply: string, lang: string) => (/[؀-ۿ]/.test(reply) ? "fa" : ["en", "de", "tr"].includes(lang) ? lang : "en");

export async function liveTurn(input: { userId: string; lang: string; voiceId: string; history: LiveHistory; conversationId?: string | null; audio?: File | null; text?: string | null }) {
  const { voices, enabled, costs } = await liveBootstrap(input.userId, false);
  if (!enabled) throw new LiveError("LIVE_UNAVAILABLE", 503);
  if (!voices.some((v) => v.id === input.voiceId)) throw new LiveError("UNSUPPORTED_VOICE");
  const minimum = turnCredits(200, costs), available = await getAvailableCredits(input.userId);
  if (available < minimum) throw new LiveError("INSUFFICIENT_CREDITS", 402, { required: minimum, available });

  let question = input.text?.trim().slice(0, 2000) || "";
  if (input.audio) {
    if (!AUDIO_TYPES.has(input.audio.type.split(";")[0]) || input.audio.size === 0 || input.audio.size > LIVE_MAX_AUDIO_BYTES) throw new LiveError("INVALID_AUDIO");
    question = await transcribe(input.audio, input.lang);
  }
  if (!question) throw new LiveError("EMPTY_TURN");

  // A saved conversation is continued from what was actually said in it (the browser's copy is only a fallback).
  const { liveConversation, recentLines, saveLine } = await import("./history");
  const conversationId = await liveConversation(input.userId, input.conversationId);
  const saved = await recentLines(conversationId);
  const history = (saved.length ? saved : input.history.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))).slice(-12);
  let answer = "", provider: Provider | null = null, usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
  try {
    await routedStreamChat([...history, { role: "user", content: question }], LIVE_PROMPT, (t) => { answer += t; }, (p) => { provider = p; }, liveModel(), ({ partial }) => { if (partial) answer = ""; }, 400, (u) => { usage = u; });
  } catch {
    throw new LiveError("ANSWER_FAILED", 502, { transcript: question });
  }
  const reply = spokenReply(answer);
  if (!reply) throw new LiveError("ANSWER_FAILED", 502, { transcript: question });

  const credits = turnCredits(reply.length, costs);
  const used = provider as Provider | null, tokens = usage as { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  const llmUsd = used && tokens ? await estimateCostUsd({ kind: "chat", providerId: used.id, inputTokens: tokens.promptTokens, outputTokens: tokens.completionTokens }) : null;
  const unit = (await voicePolicy()).modelUsdPer1k[LIVE_TTS_MODEL];
  const requestId = `live:${randomUUID()}`;
  const charged = await chargeAndLog(input.userId, credits, {
    type: "tool", provider: used?.id ?? null, model: used?.model ?? null, tokens: tokens?.totalTokens ?? null,
    inputTokens: tokens?.promptTokens ?? null, outputTokens: tokens?.completionTokens ?? null,
    estimatedCostUsd: liveCostUsd(llmUsd, unit, reply.length, null), requestId,
    metadata: { feature: "live", ttsModel: LIVE_TTS_MODEL, ttsCharacters: reply.length, voiceInput: !!input.audio },
  });
  if (!charged) throw new LiveError("INSUFFICIENT_CREDITS", 402, { required: credits, available: await getAvailableCredits(input.userId) });

  // Spoken sentence by sentence, all at once: the speech takes about as long as its longest part instead of the whole answer.
  let audio: Uint8Array[], billed: number | null = null;
  try {
    const language = speechLanguage(reply, input.lang);
    audio = await Promise.all(speechParts(reply).map((text) => synthesize({ text, voiceId: input.voiceId, modelId: LIVE_TTS_MODEL, language, settings: {} }, async (_id, credits) => { if (credits !== null) billed = (billed ?? 0) + credits; })));
  } catch {
    await refundCredits(input.userId, credits, prisma, { module: "live" });
    throw new LiveError("SPEECH_FAILED", 502, { transcript: question, reply });
  }
  // The charge was logged with the character-based estimate; replace it with what ElevenLabs billed.
  if (billed !== null && unit !== undefined) {
    await prisma.usageLog.updateMany({ where: { userId: input.userId, requestId }, data: { estimatedCostUsd: liveCostUsd(llmUsd, unit, reply.length, billed) } }).catch(() => {});
  }
  await saveLine(conversationId, "user", question);
  await saveLine(conversationId, "assistant", reply);
  return { conversationId, transcript: question, reply, audio: audio.map((part) => Buffer.from(part).toString("base64")), credits, balance: await getAvailableCredits(input.userId) };
}
