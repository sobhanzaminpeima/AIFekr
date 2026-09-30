import { getServerLang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import Public1980sClient from "./Public1980sClient";

export const dynamic = "force-dynamic";

const PAGE_KEY = "share/1980s";

/**
 * The public, no-login link for the 1980s prompt gallery -- approved
 * product decision: free for the visitor's first generation (billed
 * against the admin's own credit balance), then a message pointing to
 * /plans. Deliberately narrow to just this one prompt category rather than
 * a general free-text image endpoint -- see the API route's own doc comment
 * for why.
 */
export default async function Public1980sPage() {
  const lang = await getServerLang();

  // One row per calendar day (upsert-and-increment), so the admin view can
  // show a trend, not just a single lifetime total. Best-effort: a visit
  // that fails to record is not worth failing the page load over.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  prisma.publicPageVisit.upsert({
    where: { page_date: { page: PAGE_KEY, date: today } },
    update: { count: { increment: 1 } },
    create: { page: PAGE_KEY, date: today, count: 1 },
  }).catch(() => {});

  return <Public1980sClient lang={lang} />;
}
