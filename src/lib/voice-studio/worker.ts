import { prisma } from "@/lib/db/prisma";
import { deletePrivateObject, uploadPrivateObject, privateStorageConfigured } from "@/lib/storage/r2";
import { voicePolicy } from "./config";
import { finishGeneration } from "./service";
import { SpeechFailure, synthesize, voiceSettingsSchema, assertSpeechQuota, keepCatalogFresh } from "./provider";
import { inspectAudio } from "./audio";
import { VoiceError, type VoicePolicy } from "./domain";
import { notify } from "@/lib/notifications/create";
export async function processVoiceTick() {
    const policy = await voicePolicy();
    if (policy.enabled) await keepCatalogFresh();
    await prisma.voiceStudioGeneration.updateMany({ where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - 300000) } }, data: { status: "REVIEW", errorCode: "WORKER_INTERRUPTED_REVIEW_REQUIRED" } });
    // Object deletion is retryable and unbilled. Revoke access before removing bytes.
    const expired = await prisma.voiceStudioGeneration.findMany({ where: { status: "READY", expiresAt: { lte: new Date() } }, take: 10 });
    for (const row of expired)
        await prisma.voiceStudioGeneration.updateMany({ where: { id: row.id, status: "READY" }, data: { status: "DELETED", deletedAt: new Date(), text: "" } });
    if (privateStorageConfigured())
        for (const row of await prisma.voiceStudioGeneration.findMany({ where: { deletedAt: { not: null }, storageKey: { not: null } }, take: 10 })) {
            try {
                await deletePrivateObject(row.storageKey!);
                await prisma.voiceStudioGeneration.update({ where: { id: row.id }, data: { storageKey: null } });
            }
            catch { /* Retry on the next maintenance tick. */ }
        }
    const row = await prisma.$transaction(async (tx) => { if (await tx.voiceStudioGeneration.count({ where: { status: "RUNNING" } }) >= policy.maxConcurrent)
        return null; const next = await tx.voiceStudioGeneration.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } }); if (!next)
        return null; const claim = await tx.voiceStudioGeneration.updateMany({ where: { id: next.id, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } } }); return claim.count ? next : null; });
    if (!row)
        return { processed: 0 };
    if (!policy.enabled || !policy.allowedModels.includes(row.modelId) || policy.allowedVoices.length && !policy.allowedVoices.includes(row.voiceId)) {
        await finishGeneration(row.id, "FAILED", { errorCode: "MODULE_PAUSED_REFUNDED" });
        return { processed: 1 };
    }
    let dispatched = false;
    try {
        await assertSpeechQuota(row.providerCharacters);
        await prisma.voiceStudioGeneration.update({ where: { id: row.id }, data: { providerStartedAt: new Date() } });
        dispatched = true;
        const bytes = await synthesize({ text: row.text, voiceId: row.voiceId, modelId: row.modelId, language: row.language, settings: voiceSettingsSchema.parse(JSON.parse(row.voiceSettings)) }, async (requestId, billedCharacters) => { const snapshot = JSON.parse(row.pricingSnapshot) as VoicePolicy; const unit = snapshot.modelUsdPer1k[row.modelId]; await prisma.voiceStudioGeneration.update({ where: { id: row.id }, data: { providerRequestId: requestId, billedCharacters, providerCostUsd: unit !== undefined ? (billedCharacters ?? row.providerCharacters) * unit / 1000 : null } }); });
        const audio = await inspectAudio(bytes), snapshot = JSON.parse(row.pricingSnapshot) as VoicePolicy;
        if (audio.durationMs > snapshot.maxDurationSeconds * 1000) {
            await finishGeneration(row.id, "FAILED", { durationMs: audio.durationMs, errorCode: "OUTPUT_OVER_LIMIT_FULL_REFUND" });
            return { processed: 1 };
        }
        const storageKey = `voice-studio/${row.userId}/${row.id}.mp3`;
        // Record the deterministic object key before upload so interrupted settlements remain recoverable.
        await prisma.voiceStudioGeneration.update({ where: { id: row.id }, data: { storageKey, durationMs: audio.durationMs, bytes: bytes.length, waveform: JSON.stringify(audio.waveform) } });
        await uploadPrivateObject(bytes, storageKey, "audio/mpeg");
        const settled = await finishGeneration(row.id, "READY", { ...audio, storageKey, bytes: bytes.length });
        if (settled.status !== "READY")
            await deletePrivateObject(storageKey);
        else
            await notify(row.userId, { type: "voice_studio_ready", title: row.language === "fa" ? "فایل صوتی شما آماده است" : "Your audio is ready", link: `/voice-studio?project=${row.projectId}` });
    }
    catch (error) {
        if (!dispatched || error instanceof SpeechFailure && error.confirmedNoOutput)
            await finishGeneration(row.id, "FAILED", { errorCode: error instanceof VoiceError ? error.code : "PRECHECK_FAILED_REFUNDED" });
        else
            await prisma.voiceStudioGeneration.updateMany({ where: { id: row.id, status: "RUNNING" }, data: { status: "REVIEW", errorCode: error instanceof SpeechFailure ? error.code : "OUTCOME_REQUIRES_RECONCILIATION" } });
    }
    return { processed: 1 };
}
