export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess, businessFilter } from "@/lib/crm/workspace";
import { reverseJournalEntry } from "@/lib/accounting/ledger";
import { ledgerErrorMessage } from "@/lib/accounting/ledgerErrors";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** Reverses one of the workspace's entries: posted entries are never edited or deleted, only reversed. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (req.headers.get("origin") !== (process.env.NODE_ENV === "production" ? "https://aifekr.com" : req.nextUrl.origin)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "reverse") return NextResponse.json({ error: tri(lang, "عملیات نامعتبر است", "Invalid action", "Ungültige Aktion", "Geçersiz işlem") }, { status: 400 });

  // reverseJournalEntry() trusts its caller: the entry must be this workspace's.
  const entry = await prisma.accountingJournalEntry.findFirst({ where: { id, workspaceUserId: ws.workspaceUserId, ...businessFilter(ws) }, select: { id: true, memo: true } });
  if (!entry) return NextResponse.json({ error: tri(lang, "سند پیدا نشد", "Entry not found", "Buchung nicht gefunden", "Kayıt bulunamadı") }, { status: 404 });

  try {
    const reversal = await reverseJournalEntry(entry.id, user.id, `${tri(lang, "برگشت: ", "Reversal: ", "Storno: ", "Ters kayıt: ")}${entry.memo ?? ""}`.slice(0, 500));
    return NextResponse.json({ reversal });
  } catch (err) {
    return NextResponse.json({ error: ledgerErrorMessage(err, lang) }, { status: 400 });
  }
}
