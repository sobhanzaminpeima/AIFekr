export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { isValidRole, setUserRoleAsAdmin } from "@/lib/repositories/adminRepository";

/**
 * Role changes from the admin team page. Same rules as PUT /api/admin/users/<id>
 * (assertAdminMayManage): only a super admin changes roles, never their own,
 * and every change is audited. This route used to accept any admin, so an
 * ADMIN could promote anyone (themselves included) to SUPER_ADMIN.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, role } = await req.json().catch(() => ({}));
  if (typeof userId !== "string" || !userId || !isValidRole(role)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (auth.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a super admin can do this", code: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
  if (auth.id === userId) return NextResponse.json({ error: "You cannot change your own role", code: "CANNOT_CHANGE_OWN_ROLE" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === role) return NextResponse.json({ ok: true });

  await setUserRoleAsAdmin(userId, role);
  await prisma.auditLog.create({ data: { actorId: auth.id, action: "account_updated", targetId: userId, metadata: JSON.stringify({ fields: ["role"], changes: { role: { from: target.role, to: role } } }) } });
  return NextResponse.json({ ok: true });
}
