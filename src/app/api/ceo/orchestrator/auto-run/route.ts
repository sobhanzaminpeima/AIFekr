export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { ceoAutoRunEnabled: true, ceoAutoRunLang: true } });
  return NextResponse.json({ enabled: u?.ceoAutoRunEnabled ?? false, lang: u?.ceoAutoRunLang ?? "fa" });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { enabled } = await req.json();

  // The daily briefing is emailed by a cron with no request, so it cannot read
  // the lang cookie. Capture the language the user is actually working in at
  // the moment they switch the schedule on -- re-captured on every enable, so
  // switching UI language and re-toggling is enough to change it, with no
  // extra setting to find. Left untouched when disabling.
  const lang = await getServerLang();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: enabled ? { ceoAutoRunEnabled: true, ceoAutoRunLang: lang } : { ceoAutoRunEnabled: false },
    select: { ceoAutoRunEnabled: true, ceoAutoRunLang: true },
  });
  // Report the stored value, not the request's cookie -- disabling leaves the
  // saved language alone, so echoing the cookie here would tell the client the
  // schedule had changed language when it had not.
  return NextResponse.json({ enabled: updated.ceoAutoRunEnabled, lang: updated.ceoAutoRunLang });
}
