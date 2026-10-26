import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { processVoiceTick } from "@/lib/voice-studio/worker";
import { prisma } from "@/lib/db/prisma";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
export async function POST(req: NextRequest) { if (!isCronAuthorized(req))
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }); await prisma.siteSetting.upsert({ where: { key: "voiceStudioWorkerHeartbeat" }, create: { key: "voiceStudioWorkerHeartbeat", value: new Date().toISOString() }, update: { value: new Date().toISOString() } }); return NextResponse.json(await processVoiceTick()); }
