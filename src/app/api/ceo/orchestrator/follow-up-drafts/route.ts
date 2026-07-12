export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { generateFollowUpDrafts } from "@/lib/agents/salesFollowUp";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const drafts = await generateFollowUpDrafts(user.id);
  return NextResponse.json({ drafts });
}
