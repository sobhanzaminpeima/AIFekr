export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { generateFollowUpDrafts } from "@/lib/agents/salesFollowUp";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const lang = await getServerLang();
  try {
    const drafts = await generateFollowUpDrafts(ws.workspaceUserId, lang);
    return NextResponse.json({ drafts });
  } catch (err) {
    console.error("Sales follow-up drafts error:", err);
    return NextResponse.json({ error: lang === "fa" ? "خطا در تولید پیام‌های پیگیری" : "Failed to generate follow-up drafts" }, { status: 500 });
  }
}
