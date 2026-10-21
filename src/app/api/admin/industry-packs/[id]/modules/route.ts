export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getModulesForIndustry } from "@/lib/industry/moduleRegistry";

async function checkAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null;
  return user;
}

// Returns the full module catalog for this pack's industry, each merged
// with its current IndustryModuleFlag.enabled state (defaulting to false
// when no flag row exists yet — same fail-safe-hidden default as moduleAccess.ts).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pack = await prisma.industryPack.findUnique({ where: { id: params.id } });
  if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  const catalog = getModulesForIndustry(pack.slug);
  const flags = await prisma.industryModuleFlag.findMany({ where: { industryPackId: pack.id } });
  const flagMap = new Map(flags.map((f) => [f.moduleKey, f.enabled]));

  const modules = catalog.map((m) => ({
    ...m,
    enabled: flagMap.get(m.key) ?? false,
  }));

  return NextResponse.json({ pack: { id: pack.id, slug: pack.slug, name: pack.name }, modules });
}

// Upsert a single module's pack-level flag. Independent upsert keyed by
// (industryPackId, moduleKey) — naturally atomic, no read-modify-write race
// if two admins edit concurrently (last write wins per key).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { moduleKey, enabled } = await req.json();
  if (!moduleKey || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "moduleKey and enabled are required" }, { status: 400 });
  }

  const flag = await prisma.industryModuleFlag.upsert({
    where: { industryPackId_moduleKey: { industryPackId: params.id, moduleKey } },
    create: { industryPackId: params.id, moduleKey, enabled },
    update: { enabled },
  });

  return NextResponse.json({ flag });
}
