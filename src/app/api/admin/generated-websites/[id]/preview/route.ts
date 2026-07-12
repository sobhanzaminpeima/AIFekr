export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

async function checkAdmin(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const { requireAuth } = await import("@/lib/auth/middleware");
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAdmin(req); if (err) return err;
  const { id } = await params;
  const site = await prisma.generatedWebsite.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return new NextResponse(site.htmlCode, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
