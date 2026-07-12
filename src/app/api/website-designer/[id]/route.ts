export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const site = await prisma.generatedWebsite.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  if (site.userId !== user.id) return forbiddenResponse();

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(site.htmlCode, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(download ? { "Content-Disposition": `attachment; filename="${encodeURIComponent(site.businessName)}.html"` } : {}),
    },
  });
}
