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
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");

  const inquiries = await prisma.startupInquiry.findMany({
    where: stage && stage !== "all" ? { stage } : undefined,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ inquiries });
}

export async function PUT(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, stage, adminNote } = await req.json();
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (stage) data.stage = stage;
  if (adminNote !== undefined) data.adminNote = adminNote;

  const inquiry = await prisma.startupInquiry.update({ where: { id }, data });
  return NextResponse.json({ inquiry });
}

export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });
  await prisma.startupInquiry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
