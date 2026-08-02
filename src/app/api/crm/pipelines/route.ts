export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createPipelineFromTemplate } from "@/lib/repositories/crmRepository";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const pipelines = await prisma.crmPipeline.findMany({
    where: { userId: user.id },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ pipelines });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { name, industrySlug } = await req.json().catch(() => ({}));

  // Custom name + no template requested → a blank pipeline the user builds by hand.
  if (name && !industrySlug) {
    const isDefault = (await prisma.crmPipeline.count({ where: { userId: user.id } })) === 0;
    const pipeline = await prisma.crmPipeline.create({
      data: { userId: user.id, name, isDefault },
      include: { stages: true },
    });
    return NextResponse.json({ pipeline });
  }

  // Otherwise seed from the industry template (falls back to a generic
  // sales pipeline if industrySlug is missing/unrecognized).
  const isDefault = (await prisma.crmPipeline.count({ where: { userId: user.id } })) === 0;
  const pipeline = await createPipelineFromTemplate(user.id, industrySlug || null, isDefault);
  return NextResponse.json({ pipeline });
}
