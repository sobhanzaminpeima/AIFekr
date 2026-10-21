export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const existing = await prisma.voiceKnowledgeBase.findUnique({ where: { id } });
  if (!existing || (existing.userId !== user.id || existing.businessId !== await activeBusinessIdFor(user.id))) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  const body = await req.json().catch(()=>null);
  if(!body) return NextResponse.json({error:"Invalid request"},{status:400});
  const { title, content } = body;

  if([title,content].some(v=>v!==undefined&&(typeof v!=="string"||v.length>100000||looksLikeInjectionAttempt(v)))) return NextResponse.json({error:"Invalid knowledge content"},{status:400});
  const updated = await prisma.voiceKnowledgeBase.update({
    where: { id },
    data: {
      title: typeof title === "string" && title.trim() ? title.trim() : undefined,
      content: typeof content === "string" && content.trim() ? content.trim() : undefined,
    },
  });
  return NextResponse.json({ entry: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const existing = await prisma.voiceKnowledgeBase.findUnique({ where: { id } });
  if (!existing || (existing.userId !== user.id || existing.businessId !== await activeBusinessIdFor(user.id))) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  await prisma.voiceKnowledgeBase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
