export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getAllModules } from "@/lib/industry/moduleRegistry";

async function checkAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null;
  return user;
}

// Full module catalog merged with this customer's current overrides
// (enabled/disabled/none — "none" means the pack-level default applies).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetUser = await prisma.user.findUnique({ where: { id: params.id } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const overrides = await prisma.userModuleOverride.findMany({ where: { userId: params.id } });
  const overrideMap = new Map(overrides.map((o) => [o.moduleKey, o.enabled]));

  const modules = getAllModules().map((m) => ({
    ...m,
    override: overrideMap.has(m.key) ? overrideMap.get(m.key) : null,
  }));

  return NextResponse.json({ user: { id: targetUser.id, name: targetUser.name, industryPackId: targetUser.industryPackId }, modules });
}

// Set or clear a per-customer override. enabled: true/false sets an override;
// enabled: null removes it so the pack-level default applies again.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { moduleKey, enabled } = await req.json();
  if (!moduleKey) return NextResponse.json({ error: "moduleKey is required" }, { status: 400 });

  if (enabled === null) {
    await prisma.userModuleOverride.deleteMany({ where: { userId: params.id, moduleKey } });
    return NextResponse.json({ cleared: true });
  }

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean or null" }, { status: 400 });
  }

  const override = await prisma.userModuleOverride.upsert({
    where: { userId_moduleKey: { userId: params.id, moduleKey } },
    create: { userId: params.id, moduleKey, enabled },
    update: { enabled },
  });

  return NextResponse.json({ override });
}
