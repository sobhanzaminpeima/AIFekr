export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/**
 * The only place a document's actual file link is ever handed to a client.
 * Every call re-checks the same ownership/agent-restriction rules the list
 * endpoint uses, then mints a fresh ~1-minute signed URL and redirects —
 * so a copied/cached link expires almost immediately instead of staying
 * valid for 7 days (or forever, if the bucket is public) like the raw
 * fileUrl the app used to hand out directly.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const document = await prisma.crmDocument.findFirst({
    where: {
      id: params.id,
      userId: ws.workspaceUserId,
      ...(ws.isAgentRestricted
        ? { OR: [{ contact: { assignedToId: ws.actingUserId } }, { deal: { ownerId: ws.actingUserId } }, { property: { crmContact: { assignedToId: ws.actingUserId } } }] }
        : {}),
    },
  });
  if (!document) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  if (document.propertyId) {
    const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
    const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "crm.propertyDocuments");
    if (!allowed) return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const url = document.storageKey ? await getSignedDownloadUrl(document.storageKey, 60) : document.fileUrl;
  return NextResponse.redirect(url);
}
