export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import {
  AgentKey, buildSystemPrompt, EDITOR_PASS_THRESHOLD, MAX_WRITER_RETRIES,
  FA_TO_AGENT_KEY, extractEditorScore,
} from "@/lib/agents/contentPipeline";
import { markdownToHtml } from "@/lib/utils/markdownToHtml";
import { hasTavily, searchWeb, formatSearchResultsForPrompt } from "@/lib/search/tavily";

interface PublishResult { status: "not_published" | "published" | "failed"; url: string | null; error: string | null }

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
  send: (event: Record<string, unknown>) => void
): Promise<string> {
  send({ type: "agentStart", agentKey: key, attempt });

  const lessonRows = await prisma.contentAgentLesson.findMany({
    where: { userId, agentKey: key },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { text: true },
  });
  const lessons = lessonRows.map((r) => r.text);

  const step = await prisma.contentPipelineStep.create({
    data: { runId, agentKey: key, attempt, input, status: "running" },
  });

  const systemPrompt = buildSystemPrompt(key, brandVoice, lessons);
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

  const body = await req.json();
  const { topic, brandVoice } = body as { topic?: string; brandVoice?: string };
  if (!topic?.trim()) return NextResponse.json({ error: "موضوع الزامی است" }, { status: 400 });

  const run = await prisma.contentPipelineRun.create({
    data: { userId: user.id, topic, brandVoice: brandVoice || null, status: "running" },
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const ideas = await runAgent(user.id, run.id, "ideaFinder", `موضوع/صنعت کسب‌وکار: ${topic}`, brandVoice, 1, send);
        const strategy = await runAgent(user.id, run.id, "strategist", ideas, brandVoice, 1, send);

        const finalTitle = /عنوان نهایی\s*:\s*(.+)/.exec(strategy)?.[1]?.trim() || topic;
        const searchResults = hasTavily ? await searchWeb(`${finalTitle} ${topic}`) : null;
        const researcherInput = searchResults
          ? `${strategy}\n\n--- نتایج جستجوی زندهٔ وب (استفاده کن، منابع را ذکر کن) ---\n${formatSearchResultsForPrompt(searchResults)}`
          : strategy;
        const research = await runAgent(user.id, run.id, "researcher", researcherInput, brandVoice, 1, send);

        let draft = await runAgent(
          user.id, run.id, "writer",
          `${strategy}\n\nفکت‌ها و سوالات متداول تحقیق‌شده:\n${research}`,
          brandVoice, 1, send
        );

        let editorOutput = "";
        let score = 0;
        let writerAttempt = 1;
        for (let round = 0; round <= MAX_WRITER_RETRIES; round++) {
          editorOutput = await runAgent(user.id, run.id, "editor", draft, brandVoice, round + 1, send);
          score = extractEditorScore(editorOutput) ?? 0;
          if (score >= EDITOR_PASS_THRESHOLD || round === MAX_WRITER_RETRIES) break;
          writerAttempt += 1;
          draft = await runAgent(
            user.id, run.id, "writer",
            `نسخهٔ قبلی مقاله:\n${draft}\n\nبازخورد ویراستار که باید اعمال کنی:\n${editorOutput}`,
            brandVoice, writerAttempt, send
          );
        }

        const seoOutput = await runAgent(user.id, run.id, "seo", draft, brandVoice, 1, send);
        const metaTitle = /عنوان سئو\s*:\s*(.+)/.exec(seoOutput)?.[1]?.trim() || topic;
        const metaDescription = /توضیحات متا\s*:\s*(.+)/.exec(seoOutput)?.[1]?.trim() || "";
        const slug = /اسلاگ\s*:\s*(.+)/.exec(seoOutput)?.[1]?.trim() || `post-${run.id}`;
        const keywords = /کلمات کلیدی\s*:\s*(.+)/.exec(seoOutput)?.[1]?.trim() || "";
        const titleLine = /عنوان نهایی\s*:\s*(.+)/.exec(strategy)?.[1]?.trim() || topic;

        await runAgent(user.id, run.id, "publisher", `${draft}\n\n${seoOutput}`, brandVoice, 1, send);

        const publishResult = await publishToConnectedSite(user.id, titleLine, draft, slug, metaDescription);

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

        const critique = await runAgent(user.id, run.id, "critic", draft, brandVoice, 1, send);
        const lessonLines = critique.split("\n").filter((l) => l.includes(":"));
        for (const line of lessonLines) {
          const [faLabel, ...rest] = line.split(":");
          const agentKey = FA_TO_AGENT_KEY[faLabel.trim()];
          const text = rest.join(":").trim();
          if (agentKey && text) {
            await prisma.contentAgentLesson.create({ data: { userId: user.id, agentKey, text, source: "critic" } });
          }
        }

        await prisma.contentPipelineRun.update({ where: { id: run.id }, data: { status: "done" } });
        send({ type: "runDone", runId: run.id, postId: post.id });
      } catch (err) {
        console.error("Agent pipeline error:", err);
        await prisma.contentPipelineRun.update({ where: { id: run.id }, data: { status: "failed" } }).catch(() => {});
        send({ type: "error", message: "خطا در اجرای زنجیره agent ها. لطفاً دوباره تلاش کنید." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}
