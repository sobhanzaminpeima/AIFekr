export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const tasks = await prisma.ceoTask.findMany({
    where: { userId: user.id, ...(status && status !== "all" ? { status } : {}) },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json({ tasks });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const task = await prisma.ceoTask.updateMany({
    where: { id, userId: user.id },
    data: { status, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: task.count });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await req.json();
  await prisma.ceoTask.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
