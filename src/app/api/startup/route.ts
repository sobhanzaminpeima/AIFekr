export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const projects = await prisma.startupProject.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "نام پروژه الزامی است" }, { status: 400 });

  const project = await prisma.startupProject.create({
    data: { userId: user.id, name: name.trim(), stage: "idea" },
  });
  return NextResponse.json({ project });
}
