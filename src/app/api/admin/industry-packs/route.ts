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

  const packs = await prisma.industryPack.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { users: true, companies: true } } },
  });

  return NextResponse.json({ packs });
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const pack = await prisma.industryPack.create({
    data: {
      slug: data.slug,
      name: data.name,
      emoji: data.emoji || "🏢",
      tagline: data.tagline || "",
      valueProposition: data.valueProposition || "",
      targetCustomers: data.targetCustomers || "",
      painPoints: data.painPoints || "[]",
      agents: data.agents || "[]",
      outcomes: data.outcomes || "[]",
      kpis: data.kpis || "[]",
      tier: data.tier || "professional",
      price: data.price || 299,
      color: data.color || "#ea580c",
      gradientFrom: data.gradientFrom || "#ea580c",
      gradientTo: data.gradientTo || "#f97316",
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder || 0,
    },
  });
  return NextResponse.json({ pack });
}

export async function PUT(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  const pack = await prisma.industryPack.update({
    where: { id },
    data: {
      name: data.name,
      emoji: data.emoji,
      tagline: data.tagline,
      tier: data.tier,
      price: data.price,
      color: data.color,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });
  return NextResponse.json({ pack });
}

export async function PATCH(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, isActive } = await req.json();
  const pack = await prisma.industryPack.update({ where: { id }, data: { isActive } });
  return NextResponse.json({ pack });
}

export async function DELETE(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.industryPack.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
