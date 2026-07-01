export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { streamChat, getModelForPlan } from "@/lib/ai/claude";

const AGENT_PERSONAS: Record<string, string> = {
  ceo: "You are the CEO Agent — visionary leader focused on big-picture strategy, company mission, and long-term growth.",
  marketing: "You are the Marketing Agent — growth-focused expert in branding, customer acquisition, campaigns, and market positioning.",
  finance: "You are the Finance Agent — numbers-driven CFO focused on ROI, budget, cash flow, profitability, and financial risks.",
  seo: "You are the SEO Agent — digital visibility expert focused on search rankings, organic traffic, content strategy, and technical SEO.",
  sales: "You are the Sales Agent — revenue-focused expert in pipeline management, closing deals, customer relationships, and sales process.",
  product: "You are the Product Manager — user-centric expert focused on product roadmap, features, UX, and market fit.",
  legal: "You are the Legal Advisor — risk-aware expert focused on compliance, contracts, intellectual property, and regulatory concerns.",
};

const AGENT_COLORS: Record<string, string> = {
  ceo: "#ea580c",
  marketing: "#8b5cf6",
  finance: "#10b981",
  seo: "#3b82f6",
  sales: "#f59e0b",
  product: "#ec4899",
  legal: "#6b7280",
};

function buildMeetingPrompt(topic: string, agents: string[]) {
  const agentList = agents.map((a) => `- ${a.toUpperCase()} AGENT: ${AGENT_PERSONAS[a] || a}`).join("\n");

  return `You are facilitating a strategic business meeting. The following AI agents are attending:

${agentList}

MEETING TOPIC: ${topic}

Simulate a realistic, productive meeting with these EXACT phases:

---PHASE 1: OPENING STATEMENTS---
Each agent briefly introduces their perspective on the topic (2-3 sentences each).
Format: **[AGENT NAME]:** [statement]

---PHASE 2: DISCUSSION---
Agents debate key points, reference each other's views, challenge assumptions, and build on ideas. At least 2 exchanges per agent.
Format: **[AGENT NAME]:** [statement]

---PHASE 3: DECISIONS & ACTION ITEMS---
Agents reach consensus on:
**AGREED DECISIONS:**
1. [Decision]
2. [Decision]

**ACTION ITEMS:**
- [ ] [Task] — Owner: [Agent], Deadline: [timeframe]
- [ ] [Task] — Owner: [Agent], Deadline: [timeframe]

**MEETING SUMMARY:**
[2-3 sentence summary of outcomes]

Make the debate realistic — agents should sometimes disagree and negotiate. Keep each agent in character throughout.`;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const { topic, agents } = await req.json();

    if (!topic || !agents?.length || agents.length < 2) {
      return NextResponse.json({ error: "Topic and at least 2 agents required" }, { status: 400 });
    }

    const model = getModelForPlan(user.plan);

    const conv = await prisma.conversation.create({
      data: { userId: user.id, title: `Meeting: ${topic.slice(0, 50)}`, tool: "meeting", model },
    });

    const prompt = buildMeetingPrompt(topic, agents);
    let fullTranscript = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const agentColors = JSON.stringify(AGENT_COLORS);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: { agentColors, conversationId: conv.id } })}\n\n`));

        try {
          await streamChat(
            [{ role: "user", content: prompt }],
            "You are a meeting facilitator AI. Run structured business meetings with multiple AI agent personas.",
            model,
            (text) => {
              fullTranscript += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          );

          await prisma.message.create({
            data: { conversationId: conv.id, role: "user", content: `Meeting Topic: ${topic}\nAgents: ${agents.join(", ")}` },
          });
          await prisma.message.create({
            data: { conversationId: conv.id, role: "assistant", content: fullTranscript },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Meeting stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Meeting failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (err) {
    console.error("Meeting error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
