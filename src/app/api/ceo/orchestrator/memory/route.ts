export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { embedForStorage } from "@/lib/rag/retrieve";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const memories = await prisma.businessMemory.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ memories });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { category, text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "متن الزامی است" }, { status: 400 });
  const embedding = await embedForStorage(text.trim());
  const memory = await prisma.businessMemory.create({
    data: { userId: user.id, category: category || "general", text: text.trim(), source: "user", embedding },
  });
  return NextResponse.json({ memory });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await req.json();
  const memory = await prisma.businessMemory.findUnique({ where: { id } });
  if (!memory || memory.userId !== user.id) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  await prisma.businessMemory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
