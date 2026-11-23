import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { deleteGamingDraft, finishGamingUpload, submitGamingOrder, uploadGamingChunk } from "@/lib/video-factory/gamingShorts";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
type Context = { params: Promise<{ id: string }> };
export function DELETE(req: NextRequest, context: Context) {
  return factoryRoute(req, false, async userId => NextResponse.json(await deleteGamingDraft(userId, z.string().uuid().parse((await context.params).id))));
}
export function PUT(req: NextRequest, context: Context) {
  return factoryRoute(req, false, async userId => {
    const id = z.string().uuid().parse((await context.params).id);
    return NextResponse.json(await uploadGamingChunk(userId, id, req));
  }, 120);
}
export function POST(req: NextRequest, context: Context) {
  return factoryRoute(req, false, async userId => {
    const id = z.string().uuid().parse((await context.params).id);
    const { action } = z.object({ action: z.enum(["FINISH_UPLOAD", "SUBMIT"]) }).strict().parse(await boundedJson(req));
    return NextResponse.json({ order: action === "FINISH_UPLOAD" ? await finishGamingUpload(userId, id) : await submitGamingOrder(userId, id) });
  });
}
