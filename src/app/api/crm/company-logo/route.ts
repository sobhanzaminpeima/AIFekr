export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";

/**
 * Returns the workspace owner's company logo (uploaded in Business Doctor,
 * POST /api/business-profile/logo) so print views — invoices, contracts,
 * payslips, owner statements — can brand their output without each one
 * re-resolving Company.logoUrl itself. An AGENT acting inside an owner's
 * workspace sees the owner's logo, same as every other CRM read.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const company = await prisma.company.findUnique({ where: { userId: ws.workspaceUserId }, select: { logoUrl: true, name: true } });
  return NextResponse.json({ logoUrl: company?.logoUrl || null, companyName: company?.name || null });
}
