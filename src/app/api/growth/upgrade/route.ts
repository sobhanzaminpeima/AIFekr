import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { growthFlag } from "@/lib/growth/config";
import { upgradeFor } from "@/lib/growth/upgrade";

/** Current plan, credits and the one real package that unlocks more of a module. Never purchases anything. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!(await growthFlag("personalized_upgrade_enabled"))) return NextResponse.json({ enabled: false });
  const data = await upgradeFor(user.id, req.nextUrl.searchParams.get("module") || "");
  if (!data) return NextResponse.json({ error: "UNKNOWN_MODULE" }, { status: 400 });
  return NextResponse.json({ enabled: true, ...data });
}
