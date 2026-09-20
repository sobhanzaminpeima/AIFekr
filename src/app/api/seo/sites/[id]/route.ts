export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { nextAuditDate } from "@/lib/seo/siteAuditCore";

const FREQUENCIES = new Set(["daily", "weekly", "monthly"]);

async function ownedSite(userId: string, id: string) {
  return prisma.seoSite.findFirst({ where: { id, userId } });
}

/** Rename, or change the automatic re-audit schedule. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const site = await ownedSite(user.id, params.id);
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; autoAudit?: boolean; frequency?: string; nextAuditAt?: Date | null } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if (typeof body.autoAudit === "boolean") data.autoAudit = body.autoAudit;
  if (typeof body.frequency === "string" && FREQUENCIES.has(body.frequency)) data.frequency = body.frequency;

  // Keep the schedule consistent with the new settings.
  const autoAudit = data.autoAudit ?? site.autoAudit;
  const frequency = data.frequency ?? site.frequency;
  if (data.autoAudit !== undefined || data.frequency !== undefined) {
    data.nextAuditAt = autoAudit ? nextAuditDate(frequency, site.lastAuditAt ?? new Date()) : null;
    // A schedule turned on for a site whose next date is already past should run soon, not be pushed further out.
    if (autoAudit && data.nextAuditAt && data.nextAuditAt.getTime() < Date.now()) data.nextAuditAt = new Date();
  }

  const updated = await prisma.seoSite.update({ where: { id: site.id }, data });
  return NextResponse.json({ site: updated });
}

/** Stops tracking a site and deletes its audit history. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const site = await ownedSite(user.id, params.id);
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.seoSite.delete({ where: { id: site.id } });
  return NextResponse.json({ ok: true });
}
