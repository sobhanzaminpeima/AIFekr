export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const project = await prisma.startupProject.findFirst({ where: { id, userId: user.id } });
  if (!project) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const body = await req.json();
  const allowed = ["name", "stage", "ideaData", "financialData", "proposalData", "implementationData"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) { if (k in body) data[k] = body[k]; }

  const project = await prisma.startupProject.updateMany({ where: { id, userId: user.id }, data });
  if (project.count === 0) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  await prisma.startupProject.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ success: true });
}
