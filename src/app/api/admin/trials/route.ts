export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { voicePolicy } from "@/lib/voice-studio/config";
import { trialCatalog } from "@/lib/trials/catalog";

/** E4: every module's free-trial setting for admins. Read-only; voice is configured on its own page. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse(req);
  return NextResponse.json({ trials: trialCatalog(await voicePolicy()) });
}
