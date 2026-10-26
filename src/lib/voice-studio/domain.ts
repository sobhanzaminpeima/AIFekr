import { z } from "zod";
export class VoiceError extends Error {
    constructor(public code: string, public status = 409) { super(code); }
}
export const settingsSchema = z.object({ enabled: z.boolean().default(false), version: z.number().int().positive().default(1), creditsPerInterval: z.number().int().min(1).max(10000).default(45), billingInterval: z.union([z.literal(20), z.literal(30)]).default(30), maxCharacters: z.number().int().min(100).max(20000).default(20000), maxDurationSeconds: z.number().int().min(10).max(60).default(60), maxConcurrent: z.number().int().min(1).max(4).default(1), maxPendingPerUser: z.number().int().min(1).max(10).default(3), dailyJobs: z.number().int().min(1).max(1000).default(30), retentionDays: z.number().int().min(1).max(365).default(30), allowedPlans: z.array(z.string().max(30)).max(20).default(["PRO", "BUSINESS", "TEAM", "AGENCY"]), allowedModels: z.array(z.string().max(100)).max(30).default([]), allowedVoices: z.array(z.string().max(100)).max(300).default([]), modelUsdPer1k: z.record(z.string(), z.number().nonnegative().max(100)).default({}), priceSource: z.string().max(500).default(""), priceVerifiedAt: z.string().datetime().nullable().default(null), creditUsd: z.number().nonnegative().max(100).nullable().default(null) }).strict();
export type VoicePolicy = z.infer<typeof settingsSchema>;
export const defaults = settingsSchema.parse({});
export function graphemes(text: string) { return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length; }
export function estimatedSeconds(text: string, language: string) { const words = text.trim().split(/\s+/u).filter(Boolean).length; return Math.max(1, words * 60 / (language === "fa" ? 95 : 110), graphemes(text) / (language === "fa" ? 9 : 12)); }
export function creditsFor(seconds: number, policy: Pick<VoicePolicy, "creditsPerInterval" | "billingInterval">) { if (!Number.isFinite(seconds) || seconds <= 0)
    throw new VoiceError("INVALID_DURATION"); return Math.ceil(seconds / policy.billingInterval) * policy.creditsPerInterval; }
/** Conservative segmentation is a preview, never a guarantee of the synthesized duration. */
export function splitProject(text: string, language: string, maxSeconds: number, maxProviderChars = 5000) {
    if (!text.trim())
        return [];
    const pieces = [...new Intl.Segmenter(language, { granularity: "sentence" }).segment(text)].map(x => x.segment), out: string[] = [];
    let chunk = "";
    for (const sentence of pieces) {
        for (const word of sentence.split(/(?<=\s)/u)) {
            const next = chunk + word;
            if (chunk && (estimatedSeconds(next, language) > maxSeconds * .65 || Array.from(next).length > maxProviderChars)) {
                out.push(chunk);
                chunk = "";
            }
            if (estimatedSeconds(word, language) > maxSeconds * .65 || Array.from(word).length > maxProviderChars)
                throw new VoiceError("UNSPLITTABLE_TEXT", 400);
            chunk += word;
        }
    }
    if (chunk)
        out.push(chunk);
    return out;
}
export function projectText(text: string, max: number) { if (text.includes("\0") || graphemes(text) > max)
    throw new VoiceError("PROJECT_TEXT_TOO_LONG", 400); return text; }
