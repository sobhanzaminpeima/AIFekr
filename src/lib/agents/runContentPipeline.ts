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
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { readPipelineField } from "@/lib/agents/contentPipelineLabels";
import { createPost, loadWpConn } from "@/lib/wordpress/client";
import type { SeoFields } from "@/lib/wordpress/core";

/**
 * The 8-agent content pipeline as a plain function, so it can be driven by an
 * HTTP stream (the SEO page) or headlessly by a scheduled content plan. It used
 * to live inside the streaming route handler and could only run with a browser
 * attached.
 *
 * publishMode: "publish" writes live to the connected WordPress site, "draft"
 * saves it there as a draft, "hold" keeps the article in AiFekr only.
 */

export interface PublishResult {
  status: "not_published" | "published" | "draft" | "failed" | "held_for_review";
  /** Live URL for a published post, the wp-admin edit link for a draft. */
  url: string | null;
  error: string | null;
}

/**
 * Sends the finished post to the user's connected WordPress site, if any: as a live post
 * or a draft, with the SEO title / description / focus keyword written to the site's SEO
 * plugin (Yoast / Rank Math) when it exposes them.
 */
async function publishToConnectedSite(
  userId: string, title: string, contentMd: string, slug: string, excerpt: string,
  wpStatus: "publish" | "draft", seo: SeoFields,
): Promise<PublishResult> {
  const conn = await loadWpConn(userId);
  if (!conn) return { status: "not_published", url: null, error: null };
  const res = await createPost(conn, { title, contentHtml: markdownToHtml(contentMd), slug, excerpt, status: wpStatus, seo });
  if (!res.ok) return { status: "failed", url: null, error: res.error };
  return res.status === "publish"
    ? { status: "published", url: res.link, error: null }
    : { status: "draft", url: res.editUrl, error: null };
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


export type PublishMode = "publish" | "draft" | "hold";

export interface PipelineOptions {
  userId: string;
  runId: string;
  topic: string;
  brandVoice?: string;
  lang: Lang;
  publishMode: PublishMode;
  send?: (event: Record<string, unknown>) => void;
  /** Titles already published; the idea agent is told to pick a different angle. */
  avoidTitles?: string[];
}

export async function runContentPipeline(o: PipelineOptions): Promise<{ postId: string; publishResult: PublishResult }> {
  const { topic, brandVoice, lang } = o;
  const user = { id: o.userId };
  const run = { id: o.runId };
  const send = o.send ?? (() => {});
  const avoidNote = o.avoidTitles?.length
    ? "\n\n" + tri(lang, "این عنوان‌ها قبلاً منتشر شده‌اند؛ زاویه یا موضوعی متفاوت انتخاب کن", "These titles are already published; choose a clearly different angle or topic", "Diese Titel sind bereits veröffentlicht; wähle einen deutlich anderen Winkel oder ein anderes Thema") + ":\n- " + o.avoidTitles.slice(0, 30).join("\n- ")
    : "";

  const ideas = await runAgent(user.id, run.id, "ideaFinder", `${tri(lang, "موضوع/صنعت کسب‌وکار", "Business topic/industry", "Thema/Branche des Unternehmens")}: ${topic}${avoidNote}`, brandVoice, 1, send, lang);
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
    : o.publishMode === "hold"
  ? { status: "not_published" as const, url: null, error: null }
  : await publishToConnectedSite(user.id, titleLine, draft, slug, metaDescription, o.publishMode === "draft" ? "draft" : "publish", { title: metaTitle, description: metaDescription, focusKeyword: keywords.split(/[,،]/)[0]?.trim() || undefined });

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

  return { postId: post.id, publishResult };
}
