export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPipelineFromTemplate } from "@/lib/repositories/crmRepository";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getCrmTemplate, crmIndustryTemplates, defaultCrmTemplate } from "@/lib/crm/industryTemplates";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

// Every pipeline/stage name across every template, keyed by the Persian
// text — used to backfill nameEn/nameDe on rows created before this
// translation feature existed. Only ever matched by EXACT string, so a
// user's own custom-typed name (even if it happens not to match) is never
// touched.
const ALL_TEMPLATES = [defaultCrmTemplate, ...Object.values(crmIndustryTemplates)];
const PIPELINE_NAME_LOOKUP = new Map(ALL_TEMPLATES.map((t) => [t.pipelineName, { en: t.pipelineNameEn, de: t.pipelineNameDe }]));
const STAGE_NAME_LOOKUP = new Map(ALL_TEMPLATES.flatMap((t) => t.stages.map((s) => [s.name, { en: s.nameEn, de: s.nameDe }] as const)));

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
        data: generic.stages.map((s, i) => ({ pipelineId: p.id, name: s.name, nameEn: s.nameEn, nameDe: s.nameDe, order: i, isWon: !!s.isWon, isLost: !!s.isLost })),
      });
      if (created.count > 0) {
        p.stages = await prisma.crmStage.findMany({ where: { pipelineId: p.id }, orderBy: { order: "asc" } });
      }
    }

    // Backfill nameEn/nameDe on rows created before translations existed.
    if (p.nameEn === null) {
      const match = PIPELINE_NAME_LOOKUP.get(p.name);
      if (match) {
        await prisma.crmPipeline.update({ where: { id: p.id }, data: { nameEn: match.en, nameDe: match.de } });
        p.nameEn = match.en;
        p.nameDe = match.de;
      }
    }
    for (const s of p.stages) {
      if (s.nameEn === null) {
        const match = STAGE_NAME_LOOKUP.get(s.name);
        if (match) {
          await prisma.crmStage.update({ where: { id: s.id }, data: { nameEn: match.en, nameDe: match.de } });
          s.nameEn = match.en;
          s.nameDe = match.de;
        }
      }
    }
  }

  return NextResponse.json({ pipelines });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "فقط مدیر یا مالک می‌تواند پایپلاین بسازد", "Only a manager or owner can create a pipeline", "Nur ein Manager oder Inhaber kann eine Pipeline erstellen") }, { status: 403 });

  const { name, industrySlug } = await req.json().catch(() => ({}));

  // Custom name + no template requested → seed with the generic template's
  // stages (renamed) so the pipeline is immediately usable, rather than a
  // stage-less pipeline that leaves every stage picker empty.
  if (name && !industrySlug) {
    const isDefault = (await prisma.crmPipeline.count({ where: { userId: ws.workspaceUserId } })) === 0;
    const pipeline = await createPipelineFromTemplate(ws.workspaceUserId, null, isDefault);
    // Custom name has no translation of its own — clear the template's
    // nameEn/nameDe so it doesn't show "General Sales" in English while
    // the user's own Persian name shows in Farsi.
    const renamed = await prisma.crmPipeline.update({
      where: { id: pipeline.id },
      data: { name, nameEn: null, nameDe: null },
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
