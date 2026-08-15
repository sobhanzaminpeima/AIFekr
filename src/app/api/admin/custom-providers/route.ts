export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const providers = await prisma.customAiProvider.findMany({ orderBy: { createdAt: "desc" } });
  // API keys never leave the server once saved — the admin list only needs
  // to confirm one is set, not display/re-edit the actual value.
  return NextResponse.json({
    providers: providers.map((p) => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model, enabled: p.enabled, hasApiKey: !!p.apiKey })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const { name, baseUrl, apiKey, model } = await req.json();
  if (!name?.trim() || !baseUrl?.trim() || !apiKey?.trim() || !model?.trim()) {
    return NextResponse.json({ error: "همه‌ی فیلدها الزامی است" }, { status: 400 });
  }

  const provider = await prisma.customAiProvider.create({
    data: { name: name.trim(), baseUrl: baseUrl.trim().replace(/\/$/, ""), apiKey: apiKey.trim(), model: model.trim() },
  });
  return NextResponse.json({ provider: { id: provider.id, name: provider.name, baseUrl: provider.baseUrl, model: provider.model, enabled: provider.enabled } });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const { id, enabled } = await req.json();
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  await prisma.customAiProvider.update({ where: { id }, data: { enabled: !!enabled } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  await prisma.customAiProvider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
