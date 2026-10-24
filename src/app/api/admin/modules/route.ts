export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { MODULE_PLANS } from "@/lib/auth/planGuard";

const DEFAULT_MODULES: { key: string; name: string; minPlan: string; isCore: boolean; sortOrder: number }[] =
  Object.entries(MODULE_PLANS).map(([key, minPlan], i) => ({
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " "),
    minPlan,
    isCore: ["chat", "image"].includes(key),
    sortOrder: i,
  }));

// Seed defaults if registry is empty
async function ensureDefaults() {
  const count = await prisma.moduleRegistry.count();
  if (count === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.moduleRegistry.createMany({ data: DEFAULT_MODULES as any[] });
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  await ensureDefaults();
  const modules = await prisma.moduleRegistry.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ modules });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);

  const { key, status, minPlan } = await req.json();
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const mod = await prisma.moduleRegistry.findUnique({ where: { key } });
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });
  if (mod.isCore && status === "disabled") {
    return NextResponse.json({ error: "Core modules cannot be disabled" }, { status: 400 });
  }

  const updated = await prisma.moduleRegistry.update({
    where: { key },
    data: { ...(status && { status }), ...(minPlan && { minPlan }) },
  });
  return NextResponse.json({ module: updated });
}
