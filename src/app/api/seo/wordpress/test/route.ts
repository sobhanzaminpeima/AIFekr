export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { loadWpConn, testWordPress } from "@/lib/wordpress/client";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** Checks the saved WordPress connection: reachable, application password valid, allowed to publish, which SEO plugin. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const conn = await loadWpConn(user.id);
  if (!conn) return NextResponse.json({ ok: false, reason: "not_configured", message: tri(lang, "اتصال وردپرس هنوز ذخیره نشده است.", "No WordPress connection is saved yet.", "Es ist noch keine WordPress-Verbindung gespeichert.") });

  const t = await testWordPress(conn);
  if (t.ok) return NextResponse.json({ ok: true, siteName: t.siteName, user: t.user, seoPlugin: t.seoPlugin, canPublish: t.canPublish });

  const message =
    t.reason === "auth_failed" ? tri(lang, "نام کاربری یا رمز برنامه (Application Password) اشتباه است.", "The username or application password is wrong.", "Benutzername oder Anwendungspasswort ist falsch.")
    : t.reason === "no_permission" ? tri(lang, "این کاربر اجازه نوشتن/انتشار مطلب ندارد. یک کاربر با نقش Editor یا Administrator استفاده کنید.", "This user isn't allowed to write or publish posts. Use an Editor or Administrator account.", "Dieser Benutzer darf keine Beiträge schreiben oder veröffentlichen. Verwenden Sie ein Editor- oder Administrator-Konto.")
    : t.reason === "not_wordpress" ? tri(lang, "این آدرس REST API وردپرس را ندارد. آدرس سایت را بررسی کنید یا REST API ممکن است توسط یک افزونه امنیتی بسته شده باشد.", "This address doesn't expose the WordPress REST API. Check the URL — a security plugin may also be blocking the REST API.", "Diese Adresse stellt die WordPress-REST-API nicht bereit. Prüfen Sie die URL – ein Sicherheits-Plugin könnte die REST-API blockieren.")
    : tri(lang, "به سایت وصل نشدیم. آدرس را بررسی کنید و مطمئن شوید سایت آنلاین است.", "We couldn't reach the site. Check the address and that it is online.", "Die Website ist nicht erreichbar. Prüfen Sie die Adresse und ob sie online ist.");
  return NextResponse.json({ ok: false, reason: t.reason, message });
}
