export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/** Manual grant/revoke of the Voice Agent add-on — for support cases (comped access, refund reversal, etc.), same escape hatch pattern as other admin plan overrides. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();
  const { userId } = await params;

  const body = await req.json();
  const { voicePlan, days } = body;
  if (!["NONE", "ACTIVE"].includes(voicePlan)) return NextResponse.json({ error: "voicePlan نامعتبر" }, { status: 400 });

  const voicePlanExpiry = voicePlan === "ACTIVE"
    ? new Date(Date.now() + (typeof days === "number" ? days : 30) * 24 * 60 * 60 * 1000)
    : null;

  const user = await prisma.user.update({ where: { id: userId }, data: { voicePlan, voicePlanExpiry } });
  return NextResponse.json({ voicePlan: user.voicePlan, voicePlanExpiry: user.voicePlanExpiry });
}
