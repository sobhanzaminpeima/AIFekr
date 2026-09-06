export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import {
  AgentKey, buildSystemPrompt, EDITOR_PASS_THRESHOLD, MAX_WRITER_RETRIES,
  resolveCriticAgent, extractEditorScore,
} from "@/lib/agents/contentPipeline";
import { markdownToHtml } from "@/lib/utils/markdownToHtml";
import { hasTavily, searchWeb, formatSearchResultsForPrompt } from "@/lib/search/tavily";
import { rankByRelevance, embedForStorage } from "@/lib/rag/retrieve";
import { looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";
import { getServerLang } from "@/lib/i18n/server";
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { readPipelineField } from "@/lib/agents/contentPipelineLabels";

interface PublishResult { status: "not_published" | "published" | "failed" | "held_for_review"; url: string | null; error: string | null }

/** Publishes the finished post to the user's connected WordPress site (from the SEO tool's SeoConnection), if any. */
async function publishToConnectedSite(userId: string, title: string, contentMd: string, slug: string, excerpt: string): Promise<PublishResult> {
  const conn = await prisma.seoConnection.findUnique({ where: { userId } });
  if (!conn || conn.platform !== "wordpress" || !conn.siteUrl || !conn.wpUsername || !conn.wpAppPassword) {
    return { status: "not_published", url: null, error: null };
  }

  try {
    const base = conn.siteUrl.replace(/\/$/, "");
    const auth = "Basic " + Buffer.from(`${conn.wpUsername}:${conn.wpAppPassword}`).toString("base64");
    const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content: markdownToHtml(contentMd),
        excerpt,
        slug,
        status: "publish",
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { status: "failed", url: null, error: `WordPress error ${res.status}: ${errText.slice(0, 300)}` };
    }
    const data = await res.json();
    return { status: "published", url: data.link || null, error: null };
  } catch (err) {
    return { status: "failed", url: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runAgent(
  userId: string,
  runId: string,
  key: AgentKey,
  input: string,
  brandVoice: string | undefined,
  attempt: number,
  send: (event: Record<string, unknown>) => void,
  lang: Lang,
): Promise<string> {
  send({ type: "agentStart", agentKey: key, attempt });

  // Pull a larger recency-capped window, then re-rank by semantic relevance
  // to this specific input (e.g. "write about X") instead of always using
  // whichever 5 lessons happen to be newest — a lesson about pricing pages
  // shouldn't crowd out one about listicles when the topic today is neither.
  const lessonCandidates = await prisma.contentAgentLesson.findMany({
    where: { userId, agentKey: key },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { text: true, embedding: true, createdAt: true },
  });
  const relevantLessons = await rankByRelevance(lessonCandidates, input, 5);
  const lessons = relevantLessons.map((r) => r.text);

  // Phase 5, proposal 2 -- the other half of the shared memory. The CEO records
  // business-wide findings tagged [content]/[seo]; until now the content team
  // never saw them. Capped at 2 (against 5 of the agent's own) so second-hand
  // direction stays context and does not dominate the prompt or its token cost.
  const ceoCandidates = await prisma.businessMemory.findMany({
    where: { userId, category: { in: ["content", "seo"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { text: true, embedding: true, createdAt: true },
  });
  const crossTeamLessons = (await rankByRelevance(ceoCandidates, input, 2)).map((r) => r.text);

  const step = await prisma.contentPipelineStep.create({
    data: { runId, agentKey: key, attempt, input, status: "running" },
  });

  const systemPrompt = buildSystemPrompt(key, brandVoice, lessons, crossTeamLessons, lang);
  let output = "";

  try {
    await routedStreamChat(
      [{ role: "user", content: input }],
      systemPrompt,
      (text) => {
        output += text;
        send({ type: "agentChunk", agentKey: key, text });
      },
      () => {},
      undefined,
      undefined,
      4096
    );
  } catch (err) {
    await prisma.contentPipelineStep.update({ where: { id: step.id }, data: { status: "failed", output } });
    throw err;
  }

  let score: number | undefined;
  if (key === "editor") {
    score = extractEditorScore(output);
  }

  await prisma.contentPipelineStep.update({
    where: { id: step.id },
    data: { status: "done", output, score },
  });

  send({ type: "agentDone", agentKey: key, attempt, output, score });
  return output;
}

export async function POST(req: NextRequest) {
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
        const ideas = await runAgent(user.id, run.id, "ideaFinder", `${tri(lang, "موضوع/صنعت کسب‌وکار", "Business topic/industry", "Thema/Branche des Unternehmens")}: ${topic}`, brandVoice, 1, send, lang);
        const strategy = await runAgent(user.id, run.id, "strategist", ideas, brandVoice, 1, send, lang);

        const finalTitle = readPipelineField(strategy, "finalTitle") || topic;
        const searchResults = hasTavily ? await searchWeb(`${finalTitle} ${topic}`) : null;
        const researcherInput = searchResults
          // The glue text between agents matters as much as the prompts: the
          // researcher's own system prompt refers to this heading by name, so
          // leaving it Persian while the prompt is German breaks the link.
          ? `${strategy}\n\n--- ${tri(lang, "نتایج جستجوی زندهٔ وب (استفاده کن، منابع را ذکر کن)", "live web search results (use these, cite the sources)", "Live-Websuchergebnisse (nutze diese, nenne die Quellen)")} ---\n${formatSearchResultsForPrompt(searchResults)}`
          : strategy;
        const research = await runAgent(user.id, run.id, "researcher", researcherInput, brandVoice, 1, send, lang);

        let draft = await runAgent(
          user.id, run.id, "writer",
          `${strategy}\n\n${tri(lang, "فکت‌ها و سوالات متداول تحقیق‌شده", "Researched facts and FAQ", "Recherchierte Fakten und FAQ")}:\n${research}`,
          brandVoice, 1, send, lang,
        );

        let editorOutput = "";
        let score = 0;
        let writerAttempt = 1;
        for (let round = 0; round <= MAX_WRITER_RETRIES; round++) {
          editorOutput = await runAgent(user.id, run.id, "editor", draft, brandVoice, round + 1, send, lang);
          score = extractEditorScore(editorOutput) ?? 0;
          if (score >= EDITOR_PASS_THRESHOLD || round === MAX_WRITER_RETRIES) break;
          writerAttempt += 1;
          draft = await runAgent(
            user.id, run.id, "writer",
            `${tri(lang, "نسخهٔ قبلی مقاله", "Previous version of the article", "Vorherige Fassung des Artikels")}:\n${draft}\n\n${tri(lang, "بازخورد ویراستار که باید اعمال کنی", "Editor feedback you must apply", "Redaktionelles Feedback, das du umsetzen musst")}:\n${editorOutput}`,
            brandVoice, writerAttempt, send, lang,
          );
        }

        const seoOutput = await runAgent(user.id, run.id, "seo", draft, brandVoice, 1, send, lang);
        const metaTitle = readPipelineField(seoOutput, "seoTitle") || topic;
        const metaDescription = readPipelineField(seoOutput, "metaDescription") || "";
        const slug = readPipelineField(seoOutput, "slug") || `post-${run.id}`;
        const keywords = readPipelineField(seoOutput, "keywords") || "";
        const titleLine = readPipelineField(strategy, "finalTitle") || topic;

        // From here on, the article itself (draft + seoOutput) is already
        // complete — publisher narration, external publish, and critic
        // lessons are best-effort extras. A failure in any of them must not
        // discard the finished article, so each is wrapped independently
        // instead of sharing the outer try/catch that marks the whole run
        // "failed" (and skips creating the ContentPost).
        try {
          await runAgent(user.id, run.id, "publisher", `${draft}\n\n${seoOutput}`, brandVoice, 1, send, lang);
        } catch (err) {
          console.warn("Publisher narration step failed (non-fatal):", err);
        }

        // Auto-publish is the highest-consequence step in this pipeline — it writes
        // to the user's real WordPress site with no human in the loop. The article
        // text was built from user-supplied fields (topic, brandVoice) and live web
        // search results, both untrusted inputs that could carry an injection attempt
        // aimed at the writer/editor agents. A hit here doesn't discard the article —
        // it just holds the publish step for the user to review and publish manually.
        const suspicious = [topic, brandVoice, titleLine, draft, seoOutput]
          .some((text) => text && looksLikeInjectionAttempt(text));
        const publishResult: PublishResult = suspicious
          ? { status: "held_for_review", url: null, error: tri(lang, "محتوا برای بازبینی نگه داشته شد — الگویی مشابه تلاش برای دستکاری خودکار در متن یا نتایج جستجو شناسایی شد. لطفاً پیش از انتشار، محتوا را بررسی کنید.", "Content held for review — a pattern resembling an attempted prompt injection was detected in the text or the search results. Please review it before publishing.", "Inhalt zur Prüfung zurückgehalten — im Text oder in den Suchergebnissen wurde ein Muster erkannt, das einem Manipulationsversuch ähnelt. Bitte prüfen Sie ihn vor der Veröffentlichung.") }
          : await publishToConnectedSite(user.id, titleLine, draft, slug, metaDescription);

        const post = await prisma.contentPost.create({
          data: {
            userId: user.id,
            runId: run.id,
            title: titleLine,
            content: draft,
            metaTitle,
            metaDescription,
            slug,
            keywords,
            externalStatus: publishResult.status,
            externalUrl: publishResult.url,
            externalError: publishResult.error,
          },
        });
        send({ type: "publishResult", ...publishResult });

        // The article is saved and shareable at this point — mark the run
        // done before attempting the critic/lessons step, so a failure
        // there can't retroactively turn a successful article into a
        // "failed" run.
        await prisma.contentPipelineRun.update({ where: { id: run.id }, data: { status: "done" } });
        send({ type: "runDone", runId: run.id, postId: post.id });

        try {
          const critique = await runAgent(user.id, run.id, "critic", draft, brandVoice, 1, send, lang);
          const lessonLines = critique.split("\n").filter((l) => l.includes(":"));
          for (const line of lessonLines) {
            const [label, ...rest] = line.split(":");
            // The critic emits the agentKey now; the Persian display names it
            // used to emit still resolve, so a run started before this change
            // still attributes its lessons instead of dropping them.
            const agentKey = resolveCriticAgent(label);
            const text = rest.join(":").trim();
            if (agentKey && text) {
              const embedding = await embedForStorage(text);
              await prisma.contentAgentLesson.create({ data: { userId: user.id, agentKey, text, source: "critic", embedding } });
            }
          }
        } catch (err) {
          console.warn("Critic/lessons step failed (non-fatal):", err);
        }
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
