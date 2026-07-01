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

  const categories = await prisma.businessCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { companies: true } } },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const cat = await prisma.businessCategory.create({
    data: {
      name: data.name,
      nameEn: data.nameEn || data.name,
      icon: data.icon || "🏢",
      color: data.color || "#ea580c",
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder || 0,
    },
  });
  return NextResponse.json({ category: cat });
}

export async function PUT(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  const cat = await prisma.businessCategory.update({
    where: { id },
    data: { name: data.name, nameEn: data.nameEn, icon: data.icon, color: data.color, isActive: data.isActive, sortOrder: data.sortOrder },
  });
  return NextResponse.json({ category: cat });
}

export async function PATCH(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, isActive } = await req.json();
  const cat = await prisma.businessCategory.update({ where: { id }, data: { isActive } });
  return NextResponse.json({ category: cat });
}

export async function DELETE(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.businessCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
