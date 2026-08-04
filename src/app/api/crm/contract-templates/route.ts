export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const templates = await prisma.crmContractTemplate.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { name, content, industrySlug } = body;
  if (!name?.trim() || !content?.trim()) return NextResponse.json({ error: "نام و متن قالب الزامی است" }, { status: 400 });

  const template = await prisma.crmContractTemplate.create({
    data: { userId: user.id, name: name.trim(), content, industrySlug: industrySlug || undefined },
  });
  return NextResponse.json({ template });
}
