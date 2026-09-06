export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getHomeSummary } from "@/lib/home/summary";
import { getServerLang } from "@/lib/i18n/server";

/**
 * Deliberately not gated behind hasCrmAccess(): the home page has to render
 * for every signed-in user, including one who has not bought the CRM add-on.
 * Such a workspace simply has nothing to report, and getHomeSummary returns
 * empty counts — which the page shows as its getting-started state.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  const summary = await getHomeSummary(ws.workspaceUserId, lang);

  return NextResponse.json(summary);
}
