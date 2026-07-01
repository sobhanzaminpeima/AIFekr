export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { streamChat, getModelForPlan } from "@/lib/ai/claude";

const SYSTEM_PROMPT = `You are an expert business consultant and strategist with 20+ years of experience across multiple industries. You provide comprehensive, actionable business analysis and recommendations. Structure your responses with clear sections using markdown headers. Be specific, data-driven, and practical.`;

function buildPrompt(data: {
  businessName: string;
  industry: string;
  revenue: string;
  teamSize: string;
  challenge: string;
  goals: string;
}) {
  return `Analyze this business and provide a comprehensive diagnostic report:

Business Name: ${data.businessName}
Industry: ${data.industry}
Monthly Revenue: ${data.revenue}
Team Size: ${data.teamSize}
Top Challenge: ${data.challenge}
Business Goals: ${data.goals}

Please provide a detailed analysis with the following sections:

## SWOT Analysis
(Strengths, Weaknesses, Opportunities, Threats — each with 3-4 specific points)

## Key Challenges
(Deep dive into the top 3 challenges this business faces)

## Action Plan
### 30-Day Quick Actions
### 60-Day Milestones
### 90-Day Transformations

## KPI Recommendations
(5-7 specific KPIs this business should track with target values)

## Quick Wins
(3-5 things the business can do THIS WEEK to see immediate improvement)

Be specific to the ${data.industry} industry and the challenges mentioned. Provide actionable, concrete recommendations.`;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { businessName, industry, revenue, teamSize, challenge, goals } = body;

    if (!businessName || !industry || !challenge) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const model = getModelForPlan(user.plan);
    const prompt = buildPrompt({ businessName, industry, revenue, teamSize, challenge, goals });

    let fullResult = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await streamChat(
            [{ role: "user", content: prompt }],
            SYSTEM_PROMPT,
            model,
            (text) => {
              fullResult += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          );

          // Save to DB
          await prisma.businessAnalysis.create({
            data: {
              userId: user.id,
              businessName,
              industry,
              result: fullResult,
            },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Business doctor stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Analysis failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("Business doctor error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const last = await prisma.businessAnalysis.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ analysis: last });
}
