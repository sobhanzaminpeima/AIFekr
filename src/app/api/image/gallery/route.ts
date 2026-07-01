export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") || 1);
  const limit = 12;

  const [images, total] = await Promise.all([
    prisma.generatedImage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.generatedImage.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ images, total, page, totalPages: Math.ceil(total / limit) });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await req.json();
  const image = await prisma.generatedImage.findFirst({ where: { id, userId: user.id } });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.generatedImage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id, isPublic } = await req.json();
  const image = await prisma.generatedImage.findFirst({ where: { id, userId: user.id } });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.generatedImage.update({ where: { id }, data: { isPublic } });
  return NextResponse.json(updated);
}
