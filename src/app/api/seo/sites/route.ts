export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { normalizeUrlInput } from "@/lib/seo/urlInput";
import { siteLimitFor } from "@/lib/seo/siteAuditService";
import { nextAuditDate } from "@/lib/seo/siteAuditCore";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** The user's tracked websites, newest first, with their latest score. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const businessId = await activeBusinessIdFor(user.id);

  const sites = await prisma.seoSite.findMany({
    where: { userId: user.id, ...bizScope(businessId) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sites, limit: siteLimitFor(user.plan) });
}

/** Adds a website to track. Accepts "mysite.com" as well as a full URL; only the site's origin is stored. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const { url: raw, name } = await req.json().catch(() => ({}));
  const normalized = normalizeUrlInput(typeof raw === "string" ? raw : "");
  if (!normalized) {
    return NextResponse.json({ error: tri(lang, "آدرس وب‌سایت معتبر نیست. مثال: mysite.com", "That doesn't look like a website address. Example: mysite.com", "Das ist keine gültige Website-Adresse. Beispiel: meineseite.de", "Bu geçerli bir web adresi değil. Örnek: sitem.com") }, { status: 400 });
  }
  const url = new URL(normalized).origin + "/"; // a site is tracked by its origin; pages are discovered by the audit

  const limit = siteLimitFor(user.plan);
  const count = await prisma.seoSite.count({ where: { userId: user.id } });
  if (count >= limit) {
    return NextResponse.json({ error: tri(lang, `پلن شما حداکثر ${limit} وب‌سایت را پشتیبانی می‌کند.`, `Your plan supports up to ${limit} website(s).`, `Ihr Tarif unterstützt bis zu ${limit} Website(s).`, `Planınız en fazla ${limit} web sitesini destekler.`), code: "SITE_LIMIT" }, { status: 402 });
  }

  const existing = await prisma.seoSite.findUnique({ where: { userId_url: { userId: user.id, url } } });
  if (existing) return NextResponse.json({ error: tri(lang, "این وب‌سایت قبلاً اضافه شده است.", "This website is already added.", "Diese Website wurde bereits hinzugefügt.", "Bu web sitesi zaten eklenmiş.") }, { status: 409 });

  const site = await prisma.seoSite.create({
    data: {
      userId: user.id,
      businessId: await activeBusinessIdFor(user.id),
      url,
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : new URL(url).hostname,
      nextAuditAt: nextAuditDate("weekly", new Date()),
    },
  });
  return NextResponse.json({ site }, { status: 201 });
}
