export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { isValidRole, setUserRoleAsAdmin } from "@/lib/repositories/adminRepository";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, role } = await req.json();
  if (!userId || !isValidRole(role)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await setUserRoleAsAdmin(userId, role);
  return NextResponse.json({ ok: true });
}
