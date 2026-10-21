export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { streamProvider, type Provider } from "@/lib/ai/providers";
import { resolveCustomApiKey } from "@/lib/ai/customCredentials";
import { workersAiCredentials } from "@/lib/cloudflare/workersAi";
import { rateLimit } from "@/lib/utils/rateLimit";
import { createHash } from "node:crypto";
import { z } from "zod";
const candidate = z.object({
  prompt: z.string().min(10).max(2000),
  options: z.array(z.string().min(1).max(300)).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().min(5).max(2000),
});
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  if (!rateLimit(`play:questions:${admin.id}`, 5, 3600000).allowed)
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const b = z
      .object({
        language: z.enum(["en", "fa", "de", "tr"]),
        topic: z.enum([
          "logic",
          "mathematics",
          "technology",
          "science",
          "business",
        ]),
      })
      .strict()
      .parse(await req.json());
    const row = await prisma.customAiProvider.findUnique({
      where: { id: "cloudflare-llama-70b" },
    });
    if (!row?.enabled || row.type !== "chat")
      throw Error("AI_PROVIDER_UNAVAILABLE");
    const provider: Provider = {
      id: row.id,
      name: row.name,
      model: row.model,
      provider: "custom",
      baseURL:
        row.apiKey === "cf-ref:platform"
          ? (await workersAiCredentials()).baseURL
          : row.baseUrl,
      apiKey: await resolveCustomApiKey(row.apiKey),
      strengths: [],
      maxTokens: 1600,
      creditCost: 0,
      structuredJson: true,
    };
    let output = "";
    const usage = await streamProvider(
      provider,
      [
        {
          role: "user",
          content: `Create 3 original multiple-choice questions about ${b.topic} in language ${b.language}. Exactly 4 distinct options, exactly one correct answer, answer is zero-based. Include a factual explanation. Return {"questions":[{"prompt":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}. Avoid current events and ambiguous claims.`,
        },
      ],
      "You draft questions for human review. Never publish or decide winners. Respond only with valid JSON.",
      (chunk) => {
        output += chunk;
        if (output.length > 20000) throw Error("AI_OUTPUT_TOO_LARGE");
      },
      1600,
      AbortSignal.timeout(45000),
    );
    const parsed = z
      .object({ questions: z.array(candidate).min(1).max(3) })
      .parse(JSON.parse(output));
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const q of parsed.questions) {
        if (new Set(q.options.map((s) => s.trim().toLowerCase())).size !== 4)
          continue;
        const fingerprint = createHash("sha256")
          .update(b.language + ":" + q.prompt.trim().toLowerCase())
          .digest("hex");
        if (await tx.playQuestion.findUnique({ where: { fingerprint } }))
          continue;
        await tx.playQuestion.create({
          data: {
            ...q,
            language: b.language,
            options: JSON.stringify(q.options),
            fingerprint,
            status: "DRAFT",
          },
        });
        created++;
      }
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "play.questions.aiDrafted",
          metadata: JSON.stringify({ created, model: row.model, usage }),
        },
      });
    });
    return NextResponse.json({ created });
  } catch {
    return NextResponse.json({ error: "AI_DRAFT_FAILED" }, { status: 400 });
  }
}
