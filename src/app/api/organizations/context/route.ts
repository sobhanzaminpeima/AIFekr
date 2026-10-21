import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { resolveOrganizationContext } from "@/lib/organization/context";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const body = await req.json().catch(() => null);
  const businessId = typeof body?.businessId === "string" ? body.businessId : "";
  if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  const context = await resolveOrganizationContext(user.id, businessId);
  if (!context) return forbiddenResponse();
  await prisma.user.update({ where: { id: user.id }, data: { activeBusinessId: context.businessId } });
  return NextResponse.json({ activeBusinessId: context.businessId, organizationId: context.organizationId });
}
