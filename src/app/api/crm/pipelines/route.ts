export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPipelineFromTemplate } from "@/lib/repositories/crmRepository";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getCrmTemplate } from "@/lib/crm/industryTemplates";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const pipelines = await prisma.crmPipeline.findMany({
    where: { userId: ws.workspaceUserId },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  // Self-heal pipelines left stage-less by the old "custom name, no
  // template" creation path (fixed above, but pre-existing rows still
  // have zero stages and an empty stage picker everywhere in the UI).
  const generic = getCrmTemplate(null);
  for (const p of pipelines) {
    if (p.stages.length === 0) {
      const created = await prisma.crmStage.createMany({
        data: generic.stages.map((s, i) => ({ pipelineId: p.id, name: s.name, order: i, isWon: !!s.isWon, isLost: !!s.isLost })),
      });
      if (created.count > 0) {
        p.stages = await prisma.crmStage.findMany({ where: { pipelineId: p.id }, orderBy: { order: "asc" } });
      }
    }
  }

  return NextResponse.json({ pipelines });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (ws.isAgentRestricted) return NextResponse.json({ error: "فقط مدیر یا مالک می‌تواند پایپلاین بسازد" }, { status: 403 });

  const { name, industrySlug } = await req.json().catch(() => ({}));

  // Custom name + no template requested → seed with the generic template's
  // stages (renamed) so the pipeline is immediately usable, rather than a
  // stage-less pipeline that leaves every stage picker empty.
  if (name && !industrySlug) {
    const isDefault = (await prisma.crmPipeline.count({ where: { userId: ws.workspaceUserId } })) === 0;
    const pipeline = await createPipelineFromTemplate(ws.workspaceUserId, null, isDefault);
    const renamed = await prisma.crmPipeline.update({
      where: { id: pipeline.id },
      data: { name },
      include: { stages: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ pipeline: renamed });
  }

  // Otherwise seed from the industry template (falls back to a generic
  // sales pipeline if industrySlug is missing/unrecognized).
  const isDefault = (await prisma.crmPipeline.count({ where: { userId: ws.workspaceUserId } })) === 0;
  const pipeline = await createPipelineFromTemplate(ws.workspaceUserId, industrySlug || null, isDefault);
  return NextResponse.json({ pipeline });
}
