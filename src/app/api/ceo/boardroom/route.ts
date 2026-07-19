export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildBusinessSnapshot } from "@/lib/agents/businessSnapshot";

// ─── Department Agent Types ───────────────────────────────────────────────────

interface DeptTask { title: string; priority: "critical" | "high" | "medium" | "low"; impact: string; requiresApproval?: boolean; }
interface DepartmentReport {
  dept: string;
  deptLabel: string;
  status: "critical" | "warning" | "good";
  score: number;
  headline: string;
  problems: string[];
  opportunities: string[];
  tasks: DeptTask[];
}

// ─── Department Agent Definitions ─────────────────────────────────────────────

const DEPARTMENTS = [
  {
    id: "marketing",
    label: "مدیر بازاریابی",
    labelEn: "Marketing Director",
    color: "#10b981",
    systemPrompt: `You are AIFekr Marketing Director AI. Analyze the business snapshot and return ONLY valid JSON (no markdown, no code blocks).
JSON schema: {"status":"critical|warning|good","score":0-100,"headline":"one sentence headline","problems":["...up to 3"],"opportunities":["...up to 3"],"tasks":[{"title":"...","priority":"critical|high|medium|low","impact":"...","requiresApproval":false}]}
Focus on: brand awareness, social media performance, content marketing, digital ads, customer acquisition.
Tasks should be concrete and executable by AI. Max 3 tasks.`,
  },
  {
    id: "seo",
    label: "مدیر سئو",
    labelEn: "SEO Director",
    color: "#3b82f6",
    systemPrompt: `You are AIFekr SEO Director AI. Analyze the business snapshot and return ONLY valid JSON (no markdown, no code blocks).
JSON schema: {"status":"critical|warning|good","score":0-100,"headline":"one sentence headline","problems":["...up to 3"],"opportunities":["...up to 3"],"tasks":[{"title":"...","priority":"critical|high|medium|low","impact":"...","requiresApproval":false}]}
Focus on: keyword rankings, organic traffic, technical SEO, backlinks, content gaps, competitor SEO.
Tasks should be concrete and executable by AI. Max 3 tasks.`,
  },
  {
    id: "sales",
    label: "مدیر فروش",
    labelEn: "Sales Director",
    color: "#8b5cf6",
    systemPrompt: `You are AIFekr Sales Director AI. Analyze the business snapshot and return ONLY valid JSON (no markdown, no code blocks).
JSON schema: {"status":"critical|warning|good","score":0-100,"headline":"one sentence headline","problems":["...up to 3"],"opportunities":["...up to 3"],"tasks":[{"title":"...","priority":"critical|high|medium|low","impact":"...","requiresApproval":false}]}
Focus on: lead pipeline, conversion rates, CRM followup, sales process, revenue growth, pricing.
If there are CRM contacts needing followup, make that a high-priority task. Max 3 tasks.`,
  },
  {
    id: "finance",
    label: "مدیر مالی",
    labelEn: "Finance Director",
    color: "#f59e0b",
    systemPrompt: `You are AIFekr Finance Director AI. Analyze the business snapshot and return ONLY valid JSON (no markdown, no code blocks).
JSON schema: {"status":"critical|warning|good","score":0-100,"headline":"one sentence headline","problems":["...up to 3"],"opportunities":["...up to 3"],"tasks":[{"title":"...","priority":"critical|high|medium|low","impact":"...","requiresApproval":false}]}
Focus on: revenue trends, cash flow, cost optimization, pricing strategy, financial health, AI platform costs.
Max 3 tasks.`,
  },
  {
    id: "operations",
    label: "مدیر عملیات",
    labelEn: "Operations Director",
    color: "#ef4444",
    systemPrompt: `You are AIFekr Operations Director AI. Analyze the business snapshot and return ONLY valid JSON (no markdown, no code blocks).
JSON schema: {"status":"critical|warning|good","score":0-100,"headline":"one sentence headline","problems":["...up to 3"],"opportunities":["...up to 3"],"tasks":[{"title":"...","priority":"critical|high|medium|low","impact":"...","requiresApproval":false}]}
Focus on: workflow automation, process efficiency, tech reliability, AI platform performance, operational bottlenecks.
Max 3 tasks.`,
  },
];

// ─── CEO Synthesis Prompt ─────────────────────────────────────────────────────

const CEO_SYNTHESIS_SYSTEM = `You are AIFekr AI CEO — the most strategic executive in the business operating system. You have received reports from 5 department directors. Your job is to synthesize these into a decisive executive summary.

Speak as a Fortune 500 CEO, not a chatbot. Use "My analysis indicates..." not "I think...". Be direct, strategic, data-driven.

Structure your response in Markdown:
## خلاصه اجرایی
(3-4 sentences — the state of the business, most critical issue, and biggest opportunity)

## تصمیمات فوری (این هفته)
۱. ... (with expected impact)
۲. ...
۳. ...

## استراتژی ۳۰ روزه
(paragraph — key strategic direction)

## فرصت‌های رشد
- ...
- ...

## ریسک‌های کلیدی
- ...

Respond in the same language as the snapshot data. If data is in Farsi, respond in Farsi.`;

// ─── Run one department agent ─────────────────────────────────────────────────

async function runDeptAgent(dept: typeof DEPARTMENTS[0], snapshotText: string): Promise<DepartmentReport> {
  let raw = "";
  try {
    await routedStreamChat(
      [{ role: "user", content: snapshotText }],
      dept.systemPrompt,
      (chunk) => { raw += chunk; },
      () => {},
      undefined,
      undefined,
      800,
    );

    // Extract JSON from response (strip any markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        dept: dept.id,
        deptLabel: dept.label,
        status: parsed.status || "good",
        score: typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 70,
        headline: parsed.headline || "",
        problems: Array.isArray(parsed.problems) ? parsed.problems.slice(0, 3) : [],
        opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.slice(0, 3) : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 3) : [],
      };
    }
  } catch {}

  // Fallback if AI fails
  return { dept: dept.id, deptLabel: dept.label, status: "good", score: 70, headline: "تحلیل در دسترس نیست", problems: [], opportunities: [], tasks: [] };
}

// ─── POST /api/ceo/boardroom ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const session = await prisma.boardroomSession.create({
    data: { userId: user.id, status: "running" },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // 1. Build snapshot
        const snapshot = await buildBusinessSnapshot(user.id);
        const snapshotText = `Business Snapshot:
- Business Doctor analyses: ${snapshot.businessDoctor.totalAnalyses}, latest: ${snapshot.businessDoctor.latest ? `${snapshot.businessDoctor.latest.businessName} (${snapshot.businessDoctor.latest.industry})` : "none"}
- Content posts: ${snapshot.content.totalPosts}, recent topics: ${snapshot.content.latest.map((p) => p.title).join(", ") || "none"}
- Social posts: ${snapshot.social.totalPosts}, recent: ${snapshot.social.latest.map((s) => s.topic).join(", ") || "none"}
- CRM contacts: ${snapshot.sales.totalContacts}, needing followup: ${snapshot.sales.needingFollowUp.length} (${snapshot.sales.needingFollowUp.map((l) => l.name).join(", ") || "none"})
- Revenue last 30d: ${snapshot.data.revenueLast30d.toLocaleString()} toman
- AI platform issues last 30d: ${snapshot.data.platformProviderIssuesLast30d}
- Shared memory: ${(snapshot.memories || []).map((m) => `[${m.category}] ${m.text}`).join("; ") || "none"}`;

        send({ type: "snapshot_ready" });

        // 2. Run all 5 department agents in parallel
        send({ type: "departments_start" });

        const deptResults = await Promise.all(
          DEPARTMENTS.map(async (dept) => {
            send({ type: "dept_start", dept: dept.id, deptLabel: dept.label });
            const report = await runDeptAgent(dept, snapshotText);
            send({ type: "dept_done", report });
            return report;
          })
        );

        // 3. Compute overall health score (weighted average)
        const healthScore = Math.round(deptResults.reduce((sum, r) => sum + r.score, 0) / deptResults.length);
        send({ type: "health_score", score: healthScore });

        // 4. CEO synthesis (streaming)
        send({ type: "synthesis_start" });

        const deptSummary = deptResults.map((r) =>
          `## ${r.deptLabel} (${r.score}/100 — ${r.status})\nHeadline: ${r.headline}\nProblems: ${r.problems.join("; ")}\nOpportunities: ${r.opportunities.join("; ")}`
        ).join("\n\n");

        const synthesisPrompt = `I have received reports from all department directors. Health score: ${healthScore}/100.\n\n${deptSummary}\n\nNow synthesize these into an executive summary and strategic decisions.`;

        let synthesis = "";
        await routedStreamChat(
          [{ role: "user", content: synthesisPrompt }],
          CEO_SYNTHESIS_SYSTEM,
          (text) => {
            synthesis += text;
            send({ type: "synthesis_chunk", text });
          },
          () => {},
          undefined,
          undefined,
          1500,
        );

        // 5. Collect all tasks from all departments
        const allTasks = deptResults.flatMap((r) =>
          r.tasks.map((t) => ({ ...t, department: r.dept }))
        );

        // 6. Save tasks to DB
        const savedTasks = await Promise.all(
          allTasks.map((t) =>
            prisma.ceoTask.create({
              data: {
                userId: user.id,
                title: t.title,
                priority: t.priority || "medium",
                department: t.department,
                estimatedImpact: t.impact,
                requiresApproval: t.requiresApproval || t.priority === "critical",
                source: "boardroom",
              },
            })
          )
        );

        // 7. Update session
        await prisma.boardroomSession.update({
          where: { id: session.id },
          data: {
            status: "completed",
            healthScore,
            summary: synthesis,
            departments: JSON.stringify(deptResults),
            tasksJson: JSON.stringify(savedTasks.map((t) => t.title)),
          },
        });

        send({ type: "done", sessionId: session.id, healthScore, taskCount: savedTasks.length });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("Boardroom error:", err);
        await prisma.boardroomSession.update({ where: { id: session.id }, data: { status: "failed" } }).catch(() => {});
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "خطا در برگزاری جلسه هیئت مدیره" })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── GET /api/ceo/boardroom — last session ───────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const session = await prisma.boardroomSession.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!session) return Response.json({ session: null });

  return Response.json({
    session: {
      ...session,
      departments: session.departments ? JSON.parse(session.departments) : [],
      tasksJson: session.tasksJson ? JSON.parse(session.tasksJson) : [],
    },
  });
}
