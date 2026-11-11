export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const PAGE_SIZE = 20;

/**
 * Generated websites for the new design's admin page: the same rows the
 * classic /admin/generated-websites page reads, without the HTML itself (only
 * its size); the preview keeps using /api/admin/generated-websites/<id>/preview.
 * Users are joined by hand because some rows outlive their user.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return (await requireAuth(req)) ? forbiddenResponse(req) : unauthorizedResponse(req);
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") || "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(p.get("page"))) || 1));
  const where = q ? { businessName: { contains: q } } : {};
  const [rows, total] = await Promise.all([
    prisma.generatedWebsite.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.generatedWebsite.count({ where }),
  ]);
  const users = rows.length ? await prisma.user.findMany({ where: { id: { in: Array.from(new Set(rows.map((w) => w.userId))) } }, select: { id: true, name: true, phone: true, email: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const websites = rows.map((w) => {
    let industry: string | null = null;
    try { industry = JSON.parse(w.brief)?.industry || null; } catch { /* free-text brief */ }
    return { id: w.id, businessName: w.businessName, industry, sizeKb: Math.round((w.htmlCode.length / 1024) * 10) / 10, createdAt: w.createdAt, user: byId.get(w.userId) ?? null };
  });
  return NextResponse.json({ websites, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
}
