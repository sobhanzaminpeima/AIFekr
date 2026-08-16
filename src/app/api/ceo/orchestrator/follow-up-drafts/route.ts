export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { generateFollowUpDrafts } from "@/lib/agents/salesFollowUp";
import { getServerLang } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();
  const drafts = await generateFollowUpDrafts(user.id, lang);
  return NextResponse.json({ drafts });
}
