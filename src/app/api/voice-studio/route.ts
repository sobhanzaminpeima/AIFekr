import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { rateLimit } from "@/lib/utils/rateLimit";
import { bootstrap, saveProject, deleteProject, ownedProject, ownedGeneration, enqueueSpeech, cancelGeneration, audioUrl, voiceScope, publicGeneration, savePreset, deletePreset } from "@/lib/voice-studio/service";
import { VoiceError } from "@/lib/voice-studio/domain";
import { prisma } from "@/lib/db/prisma";
import { boundedJson } from "@/lib/voice-studio/request";
export const dynamic = "force-dynamic";
function failure(e: unknown) { return NextResponse.json({ code: e instanceof VoiceError ? e.code : e instanceof z.ZodError ? "INVALID_INPUT" : "VOICE_STUDIO_UNAVAILABLE" }, { status: e instanceof VoiceError ? e.status : e instanceof z.ZodError ? 400 : 503 }); }
export async function GET(req: NextRequest) { const user = await requireAuth(req); if (!user)
    return unauthorizedResponse(req); try {
    const id = req.nextUrl.searchParams.get("audio");
    // The native app fetches with redirects disabled, so it asks for the signed link as JSON.
    if (id && req.nextUrl.searchParams.get("format") === "json")
        return NextResponse.json({ url: await audioUrl(user.id, id, req.nextUrl.searchParams.get("download") === "1") }, { headers: { "Cache-Control": "private, no-store" } });
    if (id)
        return NextResponse.redirect(await audioUrl(user.id, id, req.nextUrl.searchParams.get("download") === "1"), { headers: { "Cache-Control": "private, no-store" } });
    const projectId = req.nextUrl.searchParams.get("project");
    if (projectId) {
        await ownedProject(user.id, projectId);
        return NextResponse.json({ generations: (await prisma.voiceStudioGeneration.findMany({ where: { projectId, ...await voiceScope(user.id), deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 })).map(publicGeneration) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(await bootstrap(user.id), { headers: { "Cache-Control": "private, no-store" } });
}
catch (e) {
    return failure(e);
} }
export async function POST(req: NextRequest) {
    const user = await requireAuth(req);
    if (!user)
        return unauthorizedResponse(req);
    // Origin guards cookie sessions against CSRF; the native app sends a bearer token and no cookie.
    const origin = req.headers.get("origin"), nativeApp = !req.cookies.get("token") && /^Bearer \S+$/i.test(req.headers.get("authorization") || "");
    if (!nativeApp && origin !==(process.env.NODE_ENV === "production" ? "https://aifekr.com" : req.nextUrl.origin))
        return NextResponse.json({ code: "INVALID_ORIGIN" }, { status: 403 });
    if (Number(req.headers.get("content-length")) > 1000000)
        return NextResponse.json({ code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    if (!rateLimit(`voice-studio:${user.id}`, 30, 60000).allowed)
        return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 });
    try {
        const body = await boundedJson(req);
        const action = z.enum(["save", "generate", "cancel", "deleteProject", "deleteAudio", "savePreset", "deletePreset"]).parse(body.action);
        if (action === "savePreset") {
            const input = z.object({ action: z.literal("savePreset"), name: z.string().trim().min(1).max(100), voiceId: z.string().max(100), modelId: z.string().max(100), settings: z.unknown() }).strict().parse(body);
            return NextResponse.json({ presets: await savePreset(user.id, input) });
        }
        if (action === "save") {
            const input = z.object({ action: z.literal("save"), id: z.string().max(100).optional(), name: z.string().trim().min(1).max(120), text: z.string().max(400000), language: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/), archive: z.boolean().optional(), duplicate: z.boolean().optional() }).strict().parse(body);
            return NextResponse.json({ project: await saveProject(user.id, input) });
        }
        if (action === "generate") {
            const input = z.object({ action: z.literal("generate"), projectId: z.string().max(100), segmentIndex: z.number().int().min(0).max(500), voiceId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), modelId: z.string().max(100), idempotencyKey: z.string().uuid(), settings: z.unknown().optional() }).strict().parse(body);
            return NextResponse.json({ generation: publicGeneration(await enqueueSpeech(user.id, input)) });
        }
        const input = z.object({ action: z.string(), id: z.string().max(100) }).strict().parse(body);
        if (action === "deletePreset")
            return NextResponse.json({ presets: await deletePreset(user.id, input.id) });
        if (action === "cancel")
            return NextResponse.json({ generation: publicGeneration(await cancelGeneration(user.id, input.id)) });
        if (action === "deleteProject")
            return NextResponse.json(await deleteProject(user.id, input.id));
        const row = await ownedGeneration(user.id, input.id);
        if (!["READY", "FAILED", "CANCELLED"].includes(row.status))
            throw new VoiceError("JOB_NOT_FINAL");
        await prisma.voiceStudioGeneration.update({ where: { id: row.id }, data: { deletedAt: new Date(), text: "" } });
        return NextResponse.json({ deleted: true });
    }
    catch (e) {
        return failure(e);
    }
}
