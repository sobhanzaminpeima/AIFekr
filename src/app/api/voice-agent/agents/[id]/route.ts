export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { deleteVapiAssistant, releasePhoneNumber } from "@/lib/voice/vapiClient";

async function loadOwnedAgent(userId: string, id: string) {
  const agent = await prisma.voiceAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== userId) return null;
  return agent;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const agent = await loadOwnedAgent(user.id, id);
  if (!agent) return NextResponse.json({ error: "ایجنت یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { name, systemPrompt, voiceId, isActive } = body;

  const updated = await prisma.voiceAgent.update({
    where: { id },
    data: {
      name: typeof name === "string" && name.trim() ? name.trim() : undefined,
      systemPrompt: typeof systemPrompt === "string" && systemPrompt.trim() ? systemPrompt.trim() : undefined,
      voiceId: voiceId === undefined ? undefined : voiceId || null,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    },
  });
  return NextResponse.json({ agent: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const agent = await loadOwnedAgent(user.id, id);
  if (!agent) return NextResponse.json({ error: "ایجنت یافت نشد" }, { status: 404 });

  // Best-effort cleanup on the Vapi side — a failure there (e.g. Vapi not
  // configured yet, or the resource already gone) must never block deleting
  // our own record, so each call is isolated and swallowed.
  if (agent.vapiPhoneNumberId) await releasePhoneNumber(agent.vapiPhoneNumberId).catch(() => {});
  if (agent.vapiAssistantId) await deleteVapiAssistant(agent.vapiAssistantId).catch(() => {});

  await prisma.voiceAgent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
