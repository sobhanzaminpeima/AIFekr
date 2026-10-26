import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { voicePolicy, voiceCredentials, saveVoiceSettings } from "@/lib/voice-studio/config";
import { settingsSchema, VoiceError } from "@/lib/voice-studio/domain";
import { refreshSpeechCatalog, speechCatalog } from "@/lib/voice-studio/provider";
import { privateStorageConfigured } from "@/lib/storage/r2";
import { finishGeneration } from "@/lib/voice-studio/service";
import { rateLimit } from "@/lib/utils/rateLimit";
import {boundedJson} from "@/lib/voice-studio/request";
import type {SpeechCatalog} from "@/lib/voice-studio/provider";
export const dynamic = "force-dynamic";
async function admin(req: NextRequest) { const user = await requireAuth(req); return user && ["ADMIN", "SUPER_ADMIN"].includes(user.role) ? user : null; }
export async function GET(req: NextRequest) { if (!await admin(req))
    return unauthorizedResponse(req); let configured = false; try {
    await voiceCredentials();
    configured = true;
}
catch { } const rows = await prisma.voiceStudioGeneration.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, userId: true, projectId: true, status: true, modelId: true, providerRequestId: true, providerCharacters: true, billedCharacters: true, providerCostUsd: true, estimatedSeconds: true, durationMs: true, reservedCredits: true, chargedCredits: true, refundedCredits: true, errorCode: true, createdAt: true, startedAt: true, completedAt: true } }); const totals = await prisma.voiceStudioGeneration.aggregate({ _sum: { chargedCredits: true, refundedCredits: true, providerCostUsd: true }, _count: true }); return NextResponse.json({ settings: await voicePolicy(), configured, privateStorage: privateStorageConfigured(), workerHeartbeat: (await prisma.siteSetting.findUnique({ where: { key: "voiceStudioWorkerHeartbeat" } }))?.value || null, catalog: await speechCatalog().catch(() => null), rows, totals }, { headers: { "Cache-Control": "private, no-store" } }); }
export async function POST(req: NextRequest) { const user = await admin(req); if (!user)
    return unauthorizedResponse(req); if (req.headers.get("origin") !== (process.env.NODE_ENV === "production" ? "https://aifekr.com" : req.nextUrl.origin))
    return NextResponse.json({ code: "INVALID_ORIGIN" }, { status: 403 }); if (!rateLimit(`admin-voice:${user.id}`, 20, 60000).allowed)
    return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 }); try {
    const body = await boundedJson(req,50000);
    if (body.action === "test") {
        const input=z.object({action:z.literal("test"),secret:z.string().min(10).max(2000).optional()}).strict().parse(body);
        const result = await refreshSpeechCatalog({secret:input.secret,persist:!input.secret});
        await prisma.auditLog.create({ data: { actorId: user.id, action: "voice_studio.connectivity_test", metadata: JSON.stringify({ success: true, modelCount: result.models.length, voiceCount: result.voices.length }) } });
        return NextResponse.json(result);
    }
    if (body.action === "settings") {
        const input = z.object({ action: z.literal("settings"), settings: settingsSchema, secret: z.string().min(10).max(2000).optional() }).strict().parse(body);
        let catalog:SpeechCatalog|undefined;
        if (input.settings.enabled) {
            if (!privateStorageConfigured())
                throw new VoiceError("PRIVATE_STORAGE_REQUIRED", 503);
            catalog = await refreshSpeechCatalog({secret:input.secret,persist:false});
            if(!input.settings.allowedModels.length){const preferred=catalog.models.find(m=>m.languages.some(l=>l.id==="fa"))||catalog.models[0];input.settings.allowedModels=[preferred.id];}
            if (input.settings.allowedModels.some(id => !catalog!.models.some(m => m.id === id)))
                throw new VoiceError("APPROVED_MODEL_REQUIRED", 400);
        }
        return NextResponse.json({ settings: await saveVoiceSettings(user.id, input.settings, input.secret,catalog) });
    }
    const input = z.object({ action: z.literal("reconcileNoOutput"), id: z.string().max(100), confirmed: z.literal(true), note: z.string().trim().min(20).max(1000) }).strict().parse(body);
    const row = await prisma.voiceStudioGeneration.findUniqueOrThrow({ where: { id: input.id } });
    if (row.status !== "REVIEW")
        throw new VoiceError("NOT_A_REVIEW_JOB");
    return NextResponse.json({ generation: await finishGeneration(row.id, "FAILED", { errorCode: "ADMIN_CONFIRMED_NO_DELIVERABLE_REFUND", adminActor: user.id, note: input.note }) });
}
catch (e) {
    return NextResponse.json({ code: e instanceof VoiceError ? e.code : e instanceof z.ZodError ? "INVALID_INPUT" : "PROVIDER_OR_CONFIGURATION_UNAVAILABLE" }, { status: e instanceof VoiceError ? e.status : e instanceof z.ZodError ? 400 : 503 });
} }
