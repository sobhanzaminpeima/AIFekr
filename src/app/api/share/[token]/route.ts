import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Try BusinessAnalysis first
  const analysis = await prisma.businessAnalysis.findUnique({
    where: { shareToken: token },
    select: {
      id: true, businessName: true, industry: true, result: true, createdAt: true,
      user: { select: { name: true } },
    },
  });

  if (analysis) {
    return NextResponse.json({
      type: "business-analysis",
      title: `آنالیز کسب‌وکار: ${analysis.businessName}`,
      subtitle: analysis.industry,
      content: analysis.result,
      author: analysis.user.name,
      createdAt: analysis.createdAt,
    });
  }

  // Try ContentPipelineRun
  const run = await prisma.contentPipelineRun.findUnique({
    where: { shareToken: token },
    select: {
      id: true, topic: true, status: true, createdAt: true,
      user: { select: { name: true } },
      steps: {
        where: { agentKey: "publisher", status: "done" },
        select: { output: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (run) {
    const publisherOutput = run.steps[0]?.output ?? null;
    return NextResponse.json({
      type: "content-pipeline",
      title: `محتوا: ${run.topic}`,
      subtitle: run.status === "done" ? "تکمیل شده" : "در حال پردازش",
      content: publisherOutput,
      author: run.user.name,
      createdAt: run.createdAt,
    });
  }

  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
