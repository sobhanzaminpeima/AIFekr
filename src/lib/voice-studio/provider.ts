import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { voiceCredentials } from "./config";
import { VoiceError } from "./domain";
import {voiceTransport} from "./transport";
export class SpeechFailure extends VoiceError {
    constructor(code: string, public confirmedNoOutput: boolean, status = 502) { super(code, status); }
}
export type SpeechModel = {
    id: string;
    name: string;
    languages: {
        id: string;
        name: string;
    }[];
    maxCharacters: number;
    style: boolean;
    speakerBoost: boolean;
};
export type SpeechVoice = {
    id: string;
    name: string;
    preview: string | null;
    labels: Record<string, string>;
};
export type SpeechCatalog = {
    models: SpeechModel[];
    voices: SpeechVoice[];
    fetchedAt: string;
};
const modelSchema = z.array(z.object({ model_id: z.string(), name: z.string(), can_do_text_to_speech: z.boolean(), languages: z.array(z.object({ language_id: z.string(), name: z.string() })).default([]), max_characters_request_free_user: z.number().optional(), max_characters_request_subscribed_user: z.number().optional(), maximum_text_length_per_request: z.number().optional(), can_use_style: z.boolean().optional(), can_use_speaker_boost: z.boolean().optional() }));
export function providerEndpoint(base: string, path: string) { return path.startsWith("/v2/") ? base.replace(/\/v1$/, "") + path : base + path; }
async function readOnly(path: string,secret?:string) { const { base, key } = await voiceCredentials(secret); for (let attempt = 0; attempt < 2; attempt++) {
    try {
        const r = await fetch(providerEndpoint(base, path), { ...voiceTransport(),headers: { "xi-api-key": key }, signal: AbortSignal.timeout(12000), redirect: "error", cache: "no-store" });
        if (!r.ok) {
            const error=await r.json().catch(()=>null);
            if(error?.detail?.status==="missing_permissions"){const permission=error.detail.message?.match(/permission\s+([a-z_]+)/i)?.[1];if(["models_read","user_read","voices_read"].includes(permission))throw new VoiceError(`ELEVENLABS_PERMISSION_${permission.toUpperCase()}`,503);}
            if (r.status >= 500 && attempt === 0) {
                await new Promise(r => setTimeout(r, 300 + Math.random() * 300));
                continue;
            }
            throw new VoiceError(`ELEVENLABS_HTTP_${r.status}`, 503);
        }
        return await r.json();
    }
    catch (e) {
        if (e instanceof VoiceError || attempt === 1)
            throw new VoiceError(e instanceof VoiceError ? e.code : "ELEVENLABS_UNREACHABLE", 503);
    }
} throw new VoiceError("ELEVENLABS_UNREACHABLE", 503); }
export async function refreshSpeechCatalog(options:{secret?:string;persist?:boolean}={}) {
    const [raw, voiceData, subscription] = await Promise.all([readOnly("/models",options.secret), readOnly("/v2/voices?page_size=100&category=premade",options.secret), readOnly("/user/subscription",options.secret)]);
    const models = modelSchema.parse(raw).filter(m => m.can_do_text_to_speech).map(m => ({ id: m.model_id, name: m.name, languages: m.languages.map(l => ({ id: l.language_id, name: l.name })), maxCharacters: Math.min(...[m.maximum_text_length_per_request, m.max_characters_request_free_user, m.max_characters_request_subscribed_user].filter((x): x is number => !!x && x > 0)), style: !!m.can_use_style, speakerBoost: !!m.can_use_speaker_boost })).filter(m => Number.isFinite(m.maxCharacters));
    const voices: SpeechVoice[] = z.object({ voices: z.array(z.object({ voice_id: z.string(), name: z.string(), category: z.string().optional(), preview_url: z.string().nullable().optional(), labels: z.record(z.string(), z.string()).optional() })) }).parse(voiceData).voices.filter(v => v.category === "premade").map(v => ({ id: v.voice_id, name: v.name, preview: v.preview_url?.startsWith("https://") ? v.preview_url : null, labels: v.labels || {} }));
    const catalog: SpeechCatalog = { models, voices, fetchedAt: new Date().toISOString() };
    if(!models.length||!voices.length)throw new VoiceError("NO_SUPPORTED_VOICES_OR_MODELS",503);
    if(options.persist!==false)await prisma.siteSetting.upsert({ where: { key: "voiceStudioCatalog" }, create: { key: "voiceStudioCatalog", value: JSON.stringify(catalog) }, update: { value: JSON.stringify(catalog) } });
    return { ...catalog, quota: { used: subscription.character_count ?? null, limit: subscription.character_limit ?? null } };
}
const CATALOG_TTL = 86400000, RETRY_AFTER_FAILURE = 600000;
let refreshing: Promise<SpeechCatalog> | null = null, lastRefreshFailure = 0;
/** One refresh at a time with the stored key (read-only calls); after a failure, wait before trying again so pages stay fast. */
async function renewCatalog() {
    if (Date.now() - lastRefreshFailure < RETRY_AFTER_FAILURE) throw new VoiceError("CATALOG_EXPIRED", 503);
    refreshing ??= refreshSpeechCatalog().catch((e) => { lastRefreshFailure = Date.now(); throw e; }).finally(() => { refreshing = null; });
    return refreshing;
}
/** The verified catalog. A day-old catalog is re-read from ElevenLabs instead of blocking every account until an admin runs the connection test. */
export async function speechCatalog(): Promise<SpeechCatalog> { const row = await prisma.siteSetting.findUnique({ where: { key: "voiceStudioCatalog" } }); if (!row)
    throw new VoiceError("CATALOG_NOT_VERIFIED", 503); const parsed = JSON.parse(row.value) as SpeechCatalog; if (Date.now() - Date.parse(parsed.fetchedAt) <= CATALOG_TTL)
    return parsed; try { return await renewCatalog(); } catch { throw new VoiceError("CATALOG_EXPIRED", 503); } }
/** Worker tick: renew a verified catalog before it expires. Never throws; the next tick or page load retries. */
export async function keepCatalogFresh(maxAgeMs = CATALOG_TTL - 4 * 3600000) { try {
    const row = await prisma.siteSetting.findUnique({ where: { key: "voiceStudioCatalog" } });
    if (row && Date.now() - Date.parse((JSON.parse(row.value) as SpeechCatalog).fetchedAt) > maxAgeMs) await renewCatalog();
} catch { /* reported to users as CATALOG_EXPIRED only once it actually expires */ } }
export async function assertSpeechQuota(characters: number) { const quota = await readOnly("/user/subscription"); if (typeof quota.character_limit !== "number" || typeof quota.character_count !== "number")
    throw new VoiceError("QUOTA_UNAVAILABLE", 503); if (quota.character_limit - quota.character_count < characters)
    throw new VoiceError("PROVIDER_QUOTA_EXCEEDED", 429); }
export const voiceSettingsSchema = z.object({ stability: z.number().min(0).max(1).optional(), similarity_boost: z.number().min(0).max(1).optional(), style: z.number().min(0).max(1).optional(), use_speaker_boost: z.boolean().optional() }).strict();
export async function synthesize(input: {
    text: string;
    voiceId: string;
    modelId: string;
    language: string;
    settings: z.infer<typeof voiceSettingsSchema>;
}, onHeaders: (id: string | null, billedCharacters: number | null) => Promise<void>) {
    const { base, key } = await voiceCredentials();
    let response: Response;
    try {
        response = await fetch(`${base}/text-to-speech/${encodeURIComponent(input.voiceId)}?output_format=mp3_44100_128`, { ...voiceTransport(),method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ text: input.text, model_id: input.modelId, language_code: input.language, voice_settings: input.settings }), signal: AbortSignal.timeout(65000), redirect: "error" });
    }
    catch {
        throw new SpeechFailure("PROVIDER_OUTCOME_UNKNOWN", false);
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new SpeechFailure(`ELEVENLABS_HTTP_${response.status}`, [400, 401, 403, 404, 422, 429].includes(response.status));
    }
    const billed = Number(response.headers.get("character-cost"));
    await onHeaders(response.headers.get("request-id"), Number.isFinite(billed) && billed > 0 ? billed : null);
    if (!response.headers.get("content-type")?.includes("audio/"))
        throw new SpeechFailure("MALFORMED_PROVIDER_AUDIO", false);
    const reader = response.body?.getReader();
    if (!reader)
        throw new SpeechFailure("EMPTY_PROVIDER_AUDIO", false);
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > 12000000) {
                await reader.cancel();
                throw new SpeechFailure("AUDIO_TOO_LARGE", false);
            }
            parts.push(value);
        }
    }
    catch (e) {
        throw e instanceof SpeechFailure ? e : new SpeechFailure("AUDIO_TRANSFER_UNKNOWN", false);
    }
    if (size < 128)
        throw new SpeechFailure("EMPTY_PROVIDER_AUDIO", false);
    return Buffer.concat(parts);
}
