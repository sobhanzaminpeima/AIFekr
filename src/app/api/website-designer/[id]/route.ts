export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { id } = await params;
  const site = await prisma.generatedWebsite.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  if (site.userId !== user.id) return forbiddenResponse(req);

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(site.htmlCode, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Generated HTML is untrusted: even a direct preview must have an opaque origin.
      "Content-Security-Policy": "sandbox allow-scripts; default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https:; font-src https: data:; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${encodeURIComponent(site.businessName)}.html"` } : {}),
    },
  });
}
