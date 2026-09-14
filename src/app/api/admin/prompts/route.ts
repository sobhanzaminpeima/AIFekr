export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

async function checkAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const toolType = searchParams.get("toolType");

  const prompts = await prisma.prompt.findMany({
    where: toolType ? { toolType } : undefined,
    orderBy: [{ toolType: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ prompts });
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, titleEn, titleDe, content, contentEn, contentDe, category, toolType, thumbnailUrl, guideFa, guideEn, guideDe, sortOrder } = body;
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "عنوان و محتوا الزامی است" }, { status: 400 });
  }

  const prompt = await prisma.prompt.create({
    data: {
      title: title.trim(),
      titleEn: titleEn?.trim() || null,
      titleDe: titleDe?.trim() || null,
      content: content.trim(),
      contentEn: contentEn?.trim() || null,
      contentDe: contentDe?.trim() || null,
      category: category || "general",
      toolType: toolType || "chat",
      thumbnailUrl: thumbnailUrl || null,
      guideFa: guideFa?.trim() || null,
      guideEn: guideEn?.trim() || null,
      guideDe: guideDe?.trim() || null,
      sortOrder: sortOrder ?? 0,
    },
  });
  return NextResponse.json({ prompt });
}

export async function PUT(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const key of ["title", "titleEn", "titleDe", "content", "contentEn", "contentDe", "category", "toolType", "thumbnailUrl", "guideFa", "guideEn", "guideDe", "sortOrder", "isActive"]) {
    if (key in rest) data[key] = rest[key];
  }

  const prompt = await prisma.prompt.update({ where: { id }, data });
  return NextResponse.json({ prompt });
}

export async function DELETE(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  await prisma.prompt.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
