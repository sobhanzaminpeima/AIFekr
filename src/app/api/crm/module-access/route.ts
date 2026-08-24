export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getModuleAccessMap } from "@/lib/industry/moduleAccess";

// Generic batch check the CRM UI calls once on mount to decide which
// industry-gated sidebar tabs to show (Properties, Owners, Viewing
// Scheduler, ...). ?keys=crm.property,crm.owner,crm.viewingScheduler
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });

  const keys = (req.nextUrl.searchParams.get("keys") || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return NextResponse.json({ access: {} });

  const access = await getModuleAccessMap({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, keys);
  return NextResponse.json({ access });
}
