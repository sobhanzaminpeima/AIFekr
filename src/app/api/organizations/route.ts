import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { createOrganizationWithBusiness } from "@/lib/organization/provisioning";
import { listAccessibleBusinesses } from "@/lib/organization/context";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const [organizations, active] = await Promise.all([
    listAccessibleBusinesses(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { activeBusinessId: true } }),
  ]);
  return NextResponse.json({ organizations, activeBusinessId: active?.activeBusinessId || null });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const body = await req.json().catch(() => null);
  const organizationName = typeof body?.organizationName === "string" ? body.organizationName.trim() : "";
  const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
  if (organizationName.length < 2 || businessName.length < 2) {
    return NextResponse.json({ error: "Organization and business names are required" }, { status: 400 });
  }
  const result = await createOrganizationWithBusiness({
    ownerId: user.id, organizationName, businessName,
    industry: typeof body.industry === "string" ? body.industry : undefined,
    country: typeof body.country === "string" ? body.country : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    currency: typeof body.currency === "string" ? body.currency : undefined,
  });
  return NextResponse.json(result, { status: 201 });
}
