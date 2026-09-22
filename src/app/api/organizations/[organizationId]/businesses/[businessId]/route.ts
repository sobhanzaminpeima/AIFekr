import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { deleteBusinessCompletely } from "@/lib/organization/deleteBusiness";

export async function DELETE(req: NextRequest, { params }: { params: { organizationId: string; businessId: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const business = await prisma.businessWorkspace.findUnique({ where: { id: params.businessId }, select: { id: true, organizationId: true, name: true } });
  if (!business || business.organizationId !== params.organizationId) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (typeof body?.confirmName !== "string" || body.confirmName.trim() !== business.name) {
    return NextResponse.json({ error: "Type the business name exactly to confirm deletion" }, { status: 400 });
  }

  const result = await deleteBusinessCompletely(params.businessId, user.id);
  if (!result.ok) {
    if (result.reason === "not_found") return NextResponse.json({ error: "Business not found" }, { status: 404 });
    if (result.reason === "last_business") return NextResponse.json({ error: "Cannot delete an organization's only remaining business" }, { status: 400 });
    return forbiddenResponse();
  }

  await prisma.organizationAuditLog.create({ data: { organizationId: params.organizationId, businessId: null, actorId: user.id, action: "business.deleted", targetType: "BusinessWorkspace", targetId: result.deletedBusinessId } }).catch(() => {});
  return NextResponse.json({ ok: true, newActiveBusinessId: result.newActiveBusinessId });
}
