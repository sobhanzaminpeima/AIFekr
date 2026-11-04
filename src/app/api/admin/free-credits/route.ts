export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { freeCreditsPolicy, saveFreeCreditsPolicy } from "@/lib/credits/freeCredits";

/** Free-credit policy for new accounts (lib/credits/freeCredits). Only a super admin may change it. */
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return unauthorizedResponse(req);
  return NextResponse.json({ policy: await freeCreditsPolicy() });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a super admin can change free credits", code: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
  const parsed = z.object({ enabled: z.boolean(), signup: z.number().int().min(0).max(10000), activationBonus: z.number().int().min(0).max(10000), expiryDays: z.number().int().min(1).max(365) }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  return NextResponse.json({ policy: await saveFreeCreditsPolicy(admin.id, parsed.data) });
}
