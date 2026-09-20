export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { withToolCredits } from "@/lib/utils/withToolCredits";
import { runContentPipeline } from "@/lib/agents/runContentPipeline";

async function handlePost(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  // The whole 8-agent chain used to be Persian-only with no language input at
  // all, so an English or German user got a Persian article out of it.
  const lang = await getServerLang();

  const body = await req.json();
  const { topic, brandVoice } = body as { topic?: string; brandVoice?: string };
  if (!topic?.trim()) return NextResponse.json({ error: tri(lang, "موضوع الزامی است", "A topic is required", "Ein Thema ist erforderlich") }, { status: 400 });
  // Unbounded topic/brandVoice text flows into every one of the 8 agent prompts below —
  // without a cap, a pasted essay multiplies token cost 8x and risks context overflow
  // in later agents that already carry lessons + research + prior drafts.
  const MAX_INPUT_LEN = 2000;
  if (topic.length > MAX_INPUT_LEN) {
    return NextResponse.json({ error: tri(lang, `موضوع نباید بیشتر از ${MAX_INPUT_LEN} کاراکتر باشد`, `The topic must not exceed ${MAX_INPUT_LEN} characters`, `Das Thema darf ${MAX_INPUT_LEN} Zeichen nicht überschreiten`) }, { status: 400 });
  }
  if (brandVoice && brandVoice.length > MAX_INPUT_LEN) {
    return NextResponse.json({ error: tri(lang, `لحن برند نباید بیشتر از ${MAX_INPUT_LEN} کاراکتر باشد`, `The brand voice must not exceed ${MAX_INPUT_LEN} characters`, `Die Markenstimme darf ${MAX_INPUT_LEN} Zeichen nicht überschreiten`) }, { status: 400 });
  }

  // Self-healing cleanup: if a previous run of this user's got orphaned mid-flight
  // (server restart/crash while status stayed "running"), it would sit stuck forever
  // with no process left to ever mark it done/failed. Sweep anything older than 10
  // minutes — a real run never legitimately takes that long — before starting a new one.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.contentPipelineRun.updateMany({
    where: { userId: user.id, status: "running", createdAt: { lt: staleThreshold } },
    data: { status: "failed" },
  });
  await prisma.contentPipelineStep.updateMany({
    where: { status: "running", createdAt: { lt: staleThreshold }, run: { userId: user.id } },
    data: { status: "failed" },
  });

  const run = await prisma.contentPipelineRun.create({
    data: { userId: user.id, topic, brandVoice: brandVoice || null, status: "running" },
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Emit runId immediately so client can show share button on completion
      send({ type: "runId", id: run.id });

      try {
        await runContentPipeline({ userId: user.id, runId: run.id, topic, brandVoice, lang, publishMode: "publish", send });
      } catch (err) {
        console.error("Agent pipeline error:", err);
        await prisma.contentPipelineRun.update({ where: { id: run.id }, data: { status: "failed" } }).catch(() => {});
        send({ type: "error", message: tri(lang, "خطا در اجرای زنجیره agent ها. لطفاً دوباره تلاش کنید.", "The agent chain failed. Please try again.", "Die Agenten-Kette ist fehlgeschlagen. Bitte versuchen Sie es erneut.") });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}

export const POST = withToolCredits("seo.pipeline", handlePost);
