import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { phoneRequired, savePhoneRequirement } from "@/lib/auth/phoneRequirement";

export const dynamic = "force-dynamic";

/** Admin → Settings: the mandatory mobile number switch. Reading is admin; changing is SUPER_ADMIN and audited. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbiddenResponse(req);
  const [enabled, total, withoutPhone] = await Promise.all([
    phoneRequired(),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", phone: null } }),
  ]);
  return NextResponse.json({ enabled, users: total, usersWithoutPhone: withoutPhone });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbiddenResponse(req);
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ code: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  await savePhoneRequirement(body.enabled, admin.id);
  return NextResponse.json({ enabled: body.enabled });
}
