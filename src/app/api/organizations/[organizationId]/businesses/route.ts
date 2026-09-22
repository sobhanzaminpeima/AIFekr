import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { canManageOrganization } from "@/lib/organization/context";
import { prisma } from "@/lib/db/prisma";

function slugPart(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "business";
}

async function membershipFor(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
}

export async function GET(req: NextRequest, { params }: { params: { organizationId: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const membership = await membershipFor(user.id, params.organizationId);
  if (!membership || membership.status !== "ACTIVE") return forbiddenResponse();
  const where = membership.allBusinesses || membership.role === "OWNER" || membership.role === "ADMIN"
    ? { organizationId: params.organizationId }
    : { organizationId: params.organizationId, members: { some: { userId: user.id, status: "ACTIVE" } } };
  const businesses = await prisma.businessWorkspace.findMany({ where, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest, { params }: { params: { organizationId: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const membership = await membershipFor(user.id, params.organizationId);
  if (!membership || membership.status !== "ACTIVE" || !canManageOrganization({ organizationId: params.organizationId, businessId: "", memberId: membership.id, role: membership.role as any, permissions: new Set(), allBusinesses: membership.allBusinesses })) return forbiddenResponse();
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2) return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  const business = await prisma.businessWorkspace.create({
    data: {
      organizationId: params.organizationId, createdById: user.id, name, slug: `${slugPart(name)}-${Math.random().toString(36).slice(2, 8)}`,
      industry: typeof body.industry === "string" ? body.industry : null,
      country: typeof body.country === "string" ? body.country : null,
      timezone: typeof body.timezone === "string" ? body.timezone : "UTC",
      currency: typeof body.currency === "string" ? body.currency : "USD",
      language: ["fa", "en", "de", "tr"].includes(body.language) ? body.language : "fa",
      description: typeof body.description === "string" ? body.description : null,
      modules: Array.isArray(body.modules) ? JSON.stringify(body.modules) : null,
      members: { create: { organizationMemberId: membership.id, userId: user.id, role: membership.role } },
    },
  });
  await prisma.organizationAuditLog.create({ data: { organizationId: params.organizationId, businessId: business.id, actorId: user.id, action: "business.created", targetType: "BusinessWorkspace", targetId: business.id } });
  return NextResponse.json({ business }, { status: 201 });
}
