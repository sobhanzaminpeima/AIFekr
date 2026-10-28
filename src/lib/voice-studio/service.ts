import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { VoiceStudioGeneration } from "@prisma/client";
import { resolveOrganizationContext } from "@/lib/organization/context";
import { effectivePlan } from "@/lib/auth/planGuard";
import { getAvailableCredits, reserveLoggedCredits, releaseLoggedCredits } from "@/lib/utils/teamCredits";
import { privateStorageConfigured, signedPrivateObject } from "@/lib/storage/r2";
import { voicePolicy } from "./config";
import { speechCatalog, voiceSettingsSchema } from "./provider";
import { VoiceError, creditsFor, graphemes, splitProject, estimatedSeconds, projectText, trialRemaining, effectivePolicy, type VoicePolicy } from "./domain";
import { trackEvent } from "@/lib/growth/events";
export async function voiceScope(userId: string) { const context = await resolveOrganizationContext(userId); return { userId, businessId: context?.businessId ?? null }; }
export type VoicePreset = {
    id: string;
    name: string;
    voiceId: string;
    modelId: string;
    settings: unknown;
};
async function presetKey(userId: string) { return `voiceStudioPresets:${userId}:${(await voiceScope(userId)).businessId || "personal"}`; }
export async function presetsFor(userId: string): Promise<VoicePreset[]> { const row = await prisma.siteSetting.findUnique({ where: { key: await presetKey(userId) } }); return row ? JSON.parse(row.value) : []; }
export async function savePreset(userId: string, preset: Omit<VoicePreset, "id">) { const list = await presetsFor(userId); if (list.length >= 20)
    throw new VoiceError("PRESET_LIMIT", 400); const settings = voiceSettingsSchema.parse(preset.settings); list.push({ ...preset, settings, id: randomUUID() }); const key = await presetKey(userId); await prisma.siteSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(list) }, update: { value: JSON.stringify(list) } }); return list; }
export async function deletePreset(userId: string, id: string) { const key = await presetKey(userId), list = (await presetsFor(userId)).filter(p => p.id !== id); await prisma.siteSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(list) }, update: { value: JSON.stringify(list) } }); return list; }
export async function ownedProject(userId: string, id: string) { const row = await prisma.voiceStudioProject.findFirst({ where: { id, ...await voiceScope(userId), deletedAt: null } }); if (!row)
    throw new VoiceError("PROJECT_NOT_FOUND", 404); return row; }
export async function ownedGeneration(userId: string, id: string) { const row = await prisma.voiceStudioGeneration.findFirst({ where: { id, ...await voiceScope(userId), deletedAt: null, project: { deletedAt: null } } }); if (!row)
    throw new VoiceError("AUDIO_NOT_FOUND", 404); return row; }
/** One rule for both the screen and enqueueSpeech: admins always, others only on an allowed plan. */
export function planAllowed(user: { role: string; plan: string; planExpiry: Date | null }, policy: Pick<VoicePolicy, "allowedPlans">) {
    return ["ADMIN", "SUPER_ADMIN"].includes(user.role) || policy.allowedPlans.includes(effectivePlan(user as Parameters<typeof effectivePlan>[0]));
}
const TRIAL_COUNTED = ["QUEUED", "RUNNING", "REVIEW", "READY", "DELETED"];
async function trialSamplesUsed(db: Pick<typeof prisma, "voiceStudioGeneration">, userId: string) {
    return db.voiceStudioGeneration.count({ where: { userId, status: { in: TRIAL_COUNTED } } });
}
export async function bootstrap(userId: string) { const policy = await voicePolicy();
    // Tell the screen up front whether this account may generate, so it can explain instead of failing on click.
    const account = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, plan: true, planExpiry: true } });
    const planOk = planAllowed(account, policy), trialLeft = trialRemaining(planOk, policy, planOk ? 0 : await trialSamplesUsed(prisma, userId));
    const access = { planAllowed: planOk, trialRemaining: trialLeft, trialMaxSeconds: policy.trialMaxSeconds, storageReady: privateStorageConfigured() }; let catalog = null, catalogError: string | null = null; try {
    catalog = await speechCatalog();
}
catch (e) {
    catalogError = e instanceof VoiceError ? e.code : "CATALOG_UNAVAILABLE";
} return { access, policy: { enabled: policy.enabled, version: policy.version, maxCharacters: policy.maxCharacters, maxDurationSeconds: effectivePolicy(policy, trialLeft > 0).maxDurationSeconds, creditsPerInterval: policy.creditsPerInterval, billingInterval: policy.billingInterval, allowedModels: policy.allowedModels, allowedVoices: policy.allowedVoices }, catalog, catalogError, presets: await presetsFor(userId), credits: await getAvailableCredits(userId), projects: await prisma.voiceStudioProject.findMany({ where: { ...await voiceScope(userId), deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 100 }) }; }
export async function saveProject(userId: string, input: {
    id?: string;
    name: string;
    text: string;
    language: string;
    archive?: boolean;
    duplicate?: boolean;
}) { const policy = await voicePolicy(); projectText(input.text, policy.maxCharacters); if (input.id) {
    const old = await ownedProject(userId, input.id);
    if (input.duplicate)
        return prisma.voiceStudioProject.create({ data: { ...await voiceScope(userId), name: input.name, text: input.text, language: input.language } });
    return prisma.voiceStudioProject.update({ where: { id: old.id }, data: { name: input.name, text: input.text, language: input.language, ...(input.archive !== undefined ? { archivedAt: input.archive ? new Date() : null } : {}) } });
} return prisma.voiceStudioProject.create({ data: { ...await voiceScope(userId), name: input.name, text: input.text, language: input.language } }); }
export async function deleteProject(userId: string, id: string) { const row = await ownedProject(userId, id); return prisma.$transaction(async (tx) => { if (await tx.voiceStudioGeneration.count({ where: { projectId: id, status: { in: ["QUEUED", "RUNNING", "REVIEW"] } } }))
    throw new VoiceError("PROJECT_HAS_PENDING_JOBS"); await tx.voiceStudioProject.update({ where: { id: row.id }, data: { deletedAt: new Date(), text: "" } }); await tx.voiceStudioGeneration.updateMany({ where: { projectId: id }, data: { deletedAt: new Date(), text: "" } }); return { deleted: true }; }); }
export type GenerationInput = {
    projectId: string;
    segmentIndex: number;
    voiceId: string;
    modelId: string;
    idempotencyKey: string;
    settings?: unknown;
};
export async function enqueueSpeech(userId: string, input: GenerationInput) {
    const basePolicy = await voicePolicy();
    const blocked = await prisma.moduleRegistry.findUnique({ where: { key: "voice-studio" } });
    if (!basePolicy.enabled || blocked && ["disabled", "maintenance"].includes(blocked.status))
        throw new VoiceError("VOICE_STUDIO_DISABLED", 503);
    if (!privateStorageConfigured())
        throw new VoiceError("PRIVATE_STORAGE_REQUIRED", 503);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, plan: true, planExpiry: true } });
    const planOk = planAllowed(user, basePolicy);
    // Outside allowedPlans only a configured trial sample is possible; it is re-checked inside the transaction.
    if (!planOk && trialRemaining(false, basePolicy, await trialSamplesUsed(prisma, userId)) < 1)
        throw new VoiceError("PLAN_REQUIRED", 403);
    const policy = effectivePolicy(basePolicy, !planOk);
    const project = await ownedProject(userId, input.projectId);
    if (project.archivedAt)
        throw new VoiceError("PROJECT_ARCHIVED");
    projectText(project.text, policy.maxCharacters);
    const catalog = await speechCatalog(), model = catalog.models.find(m => m.id === input.modelId), voice = catalog.voices.find(v => v.id === input.voiceId);
    if (!model || !voice || !policy.allowedModels.includes(model.id) || policy.allowedVoices.length && !policy.allowedVoices.includes(voice.id))
        throw new VoiceError("VOICE_MODEL_NOT_APPROVED", 400);
    if (!model.languages.some(l => l.id === project.language))
        throw new VoiceError("LANGUAGE_NOT_SUPPORTED", 400);
    const settings = voiceSettingsSchema.parse(input.settings || {});
    if (settings.style !== undefined && !model.style || settings.use_speaker_boost !== undefined && !model.speakerBoost)
        throw new VoiceError("UNSUPPORTED_VOICE_SETTINGS", 400);
    if (model.id === "eleven_v3" && settings.stability !== undefined && ![0, .5, 1].includes(settings.stability))
        throw new VoiceError("UNSUPPORTED_STABILITY", 400);
    const segments = splitProject(project.text, project.language, policy.maxDurationSeconds, model.maxCharacters), text = segments[input.segmentIndex];
    if (!text)
        throw new VoiceError("INVALID_SEGMENT", 400);
    const inputHash = createHash("sha256").update(JSON.stringify({ text, voice: voice.id, model: model.id, language: project.language, settings, segment: input.segmentIndex, project: project.id })).digest("hex"), id = randomUUID(), reserved = creditsFor(policy.maxDurationSeconds, policy);
    return prisma.$transaction(async (tx) => {
        const previous = await tx.voiceStudioGeneration.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
        if (previous) {
            if (previous.inputHash !== inputHash)
                throw new VoiceError("IDEMPOTENCY_CONFLICT");
            return previous;
        }
        const currentProject = await tx.voiceStudioProject.findFirst({ where: { id: project.id, userId, businessId: project.businessId, deletedAt: null, archivedAt: null } });
        if (!currentProject)
            throw new VoiceError("PROJECT_NOT_FOUND", 404);
        if (currentProject.updatedAt.getTime() !== project.updatedAt.getTime())
            throw new VoiceError("PROJECT_CHANGED_RETRY");
        if (!planOk && trialRemaining(false, basePolicy, await trialSamplesUsed(tx, userId)) < 1)
            throw new VoiceError("PLAN_REQUIRED", 403);
        if (await tx.voiceStudioGeneration.count({ where: { userId, status: { in: ["QUEUED", "RUNNING", "REVIEW"] } } }) >= policy.maxPendingPerUser)
            throw new VoiceError("TOO_MANY_PENDING_JOBS", 429);
        if (await tx.voiceStudioGeneration.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= policy.dailyJobs)
            throw new VoiceError("DAILY_QUOTA_REACHED", 429);
        const reservation = await reserveLoggedCredits(tx, userId, reserved, { type: "voice_studio", provider: "elevenlabs", model: model.id, requestId: `voice:${id}:reserve`, metadata: { generationId: id, pricingVersion: policy.version, kind: "RESERVATION", trial: !planOk } });
        if (!reservation)
            throw new VoiceError("INSUFFICIENT_CREDITS", 402);
        return tx.voiceStudioGeneration.create({ data: { id, userId, businessId: project.businessId, projectId: project.id, idempotencyKey: input.idempotencyKey, inputHash, text, graphemes: graphemes(text), providerCharacters: Array.from(text).length, segmentIndex: input.segmentIndex, language: project.language, voiceId: voice.id, modelId: model.id, voiceSettings: JSON.stringify(settings), pricingSnapshot: JSON.stringify(policy), estimatedSeconds: estimatedSeconds(text, project.language), reservedCredits: reserved, ...reservation } });
    });
}
/** Exactly one final transition owns settlement; all ledger rows are append-only. */
export async function finishGeneration(id: string, status: "READY" | "FAILED" | "CANCELLED", details: {
    durationMs?: number;
    storageKey?: string;
    bytes?: number;
    waveform?: number[];
    errorCode?: string;
    adminActor?: string;
    note?: string;
} = {}) {
    let settled = false;
    const result = await prisma.$transaction(async (tx) => {
        const row = await tx.voiceStudioGeneration.findUniqueOrThrow({ where: { id } });
        if (!["RUNNING", "QUEUED", "REVIEW"].includes(row.status))
            return row;
        settled = true;
        const policy = JSON.parse(row.pricingSnapshot) as VoicePolicy;
        if (status === "READY" && (!details.storageKey || !details.durationMs || details.durationMs > policy.maxDurationSeconds * 1000))
            throw new VoiceError("INVALID_FINAL_AUDIO");
        const charged = status === "READY" ? creditsFor(details.durationMs! / 1000, policy) : 0;
        if (charged > row.reservedCredits)
            throw new VoiceError("RESERVATION_EXCEEDED");
        const changed = await tx.voiceStudioGeneration.updateMany({ where: { id, status: row.status }, data: { status, chargedCredits: charged, refundedCredits: row.reservedCredits - charged, durationMs: details.durationMs, storageKey: details.storageKey, bytes: details.bytes, waveform: details.waveform ? JSON.stringify(details.waveform) : undefined, errorCode: details.errorCode, completedAt: new Date(), expiresAt: status === "READY" ? new Date(Date.now() + policy.retentionDays * 86400000) : null } });
        if (!changed.count)
            throw new VoiceError("JOB_CHANGED");
        await releaseLoggedCredits(tx, row, row.reservedCredits - charged, `voice:${id}:refund`, { generationId: id, status });
        await tx.usageLog.create({ data: { userId: row.userId, type: "voice_studio_settlement", credits: 0, requestId: `voice:${id}:settle`, provider: "elevenlabs", model: row.modelId, mediaSeconds: details.durationMs ? details.durationMs / 1000 : null, estimatedCostUsd: row.providerCostUsd, metadata: JSON.stringify({ generationId: id, charged, pricingVersion: policy.version, status }) } });
        if (details.adminActor)
            await tx.auditLog.create({ data: { actorId: details.adminActor, action: "voice_studio.reconciled", targetId: id, metadata: JSON.stringify({ status, note: details.note }) } });
        return tx.voiceStudioGeneration.findUniqueOrThrow({ where: { id } });
    });
    if (settled && status !== "CANCELLED")
        await recordVoiceOutcome(result.userId, id, status);
    return result;
}
/** Growth events from the authoritative final state (after commit), never from the Generate click. */
async function recordVoiceOutcome(userId: string, id: string, status: "READY" | "FAILED") {
    if (status === "FAILED") {
        await trackEvent({ name: "ai_generation_failed", userId, moduleId: "voice-studio", idempotencyKey: `voice:${id}:failed` });
        return;
    }
    await trackEvent({ name: "ai_generation_succeeded", userId, moduleId: "voice-studio", idempotencyKey: `voice:${id}:ready` });
    const ready = await prisma.voiceStudioGeneration.count({ where: { userId, status: { in: ["READY", "DELETED"] }, storageKey: { not: null } } });
    if (ready === 1) {
        await trackEvent({ name: "first_voice_generated", userId, moduleId: "voice-studio", idempotencyKey: `voice:first:${userId}` });
        await trackEvent({ name: "first_value_achieved", userId, moduleId: "voice-studio", idempotencyKey: `fv:voice-studio:${userId}` });
    } else if (ready === 2)
        await trackEvent({ name: "second_voice_generated", userId, moduleId: "voice-studio", idempotencyKey: `voice:second:${userId}` });
}
export async function cancelGeneration(userId: string, id: string) { const row = await ownedGeneration(userId, id); if (row.status === "CANCELLED")
    return row; if (row.status !== "QUEUED")
    throw new VoiceError("CANNOT_CANCEL_DISPATCHED_JOB"); return prisma.$transaction(async (tx) => { const changed = await tx.voiceStudioGeneration.updateMany({ where: { id, status: "QUEUED" }, data: { status: "CANCELLED", refundedCredits: row.reservedCredits, completedAt: new Date() } }); if (changed.count)
    await releaseLoggedCredits(tx, row, row.reservedCredits, `voice:${id}:refund`, { generationId: id, status: "CANCELLED" }); return tx.voiceStudioGeneration.findUniqueOrThrow({ where: { id } }); }); }
export async function audioUrl(userId: string, id: string, download = false) { const row = await ownedGeneration(userId, id); if (row.status !== "READY" || !row.storageKey || !row.expiresAt || row.expiresAt <= new Date())
    throw new VoiceError("AUDIO_EXPIRED_OR_UNAVAILABLE", 410); return signedPrivateObject(row.storageKey, download ? `aifekr-${row.id}.mp3` : undefined); }
export function publicGeneration(row: VoiceStudioGeneration) { const output = { ...row }; for (const key of ["storageKey", "pricingSnapshot", "usageLogId", "payerTeamId", "mirroredAi", "inputHash"] as const)
    Reflect.deleteProperty(output, key); return output; }
