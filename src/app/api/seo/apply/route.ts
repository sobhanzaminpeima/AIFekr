export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { loadWpConn, applySeoToUrl } from "@/lib/wordpress/client";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

interface ApplyResult {
  field: string;
  applied: boolean;
  note?: string;
}

async function applyToAiFekrSite(
  userId: string,
  websiteId: string,
  title?: string,
  metaDescription?: string
): Promise<{ ok: boolean; results: ApplyResult[]; error?: string }> {
  const site = await prisma.generatedWebsite.findFirst({ where: { id: websiteId, userId } });
  if (!site) return { ok: false, results: [], error: "سایت یافت نشد" };

  let html = site.htmlCode;
  const results: ApplyResult[] = [];

  if (title) {
    if (/<title[^>]*>[^<]*<\/title>/i.test(html)) {
      html = html.replace(/<title[^>]*>[^<]*<\/title>/i, `<title>${title}</title>`);
    } else {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n<title>${title}</title>`);
    }
    results.push({ field: "title", applied: true });
  }

  if (metaDescription) {
    const metaTag = `<meta name="description" content="${metaDescription.replace(/"/g, "&quot;")}">`;
    if (/<meta[^>]*name=["']description["'][^>]*>/i.test(html)) {
      html = html.replace(/<meta[^>]*name=["']description["'][^>]*>/i, metaTag);
    } else {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${metaTag}`);
    }
    results.push({ field: "metaDescription", applied: true });
  }

  await prisma.generatedWebsite.update({ where: { id: site.id }, data: { htmlCode: html } });
  return { ok: true, results };
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { url, title, metaDescription, websiteId, focusKeyword } = await req.json();

  const conn = await prisma.seoConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "ابتدا پلتفرم وبسایت خود را در بالای صفحه متصل کنید" }, { status: 400 });

  if (conn.platform === "wordpress") {
    const lang = await getServerLang();
    if (!url) return NextResponse.json({ error: tri(lang, "آدرس صفحه الزامی است", "The page URL is required", "Die Seiten-URL ist erforderlich") }, { status: 400 });
    const wpConn = await loadWpConn(user.id);
    if (!wpConn) return NextResponse.json({ error: tri(lang, "اتصال وردپرس کامل نیست", "The WordPress connection is incomplete", "Die WordPress-Verbindung ist unvollständig") }, { status: 400 });

    const r = await applySeoToUrl(wpConn, url, { title, description: metaDescription, focusKeyword });
    if (!r.ok) {
      const message =
        r.reason === "no_plugin" ? tri(lang, "سایت وردپرس شما افزونه سئوی پشتیبانی‌شده (Yoast یا Rank Math) ندارد، پس عنوان و توضیحات سئو خودکار ثبت نمی‌شود. متن پیشنهادی را کپی و در وردپرس جایگذاری کنید.", "Your WordPress site has no supported SEO plugin (Yoast or Rank Math), so the SEO title and description can't be set automatically. Copy the suggested text into WordPress instead.", "Ihre WordPress-Website hat kein unterstütztes SEO-Plugin (Yoast oder Rank Math), daher können SEO-Titel und -Beschreibung nicht automatisch gesetzt werden. Kopieren Sie den Vorschlag stattdessen in WordPress.")
        : r.reason === "not_found" ? tri(lang, "این صفحه در وردپرس پیدا نشد (slug مطابقت نداشت).", "That page wasn't found in WordPress (no slug matched).", "Diese Seite wurde in WordPress nicht gefunden (kein Slug passt).")
        : tri(lang, "وردپرس این تغییر را نپذیرفت: ", "WordPress rejected the change: ", "WordPress hat die Änderung abgelehnt: ") + (r.message ?? "");
      return NextResponse.json({ error: message, reason: r.reason }, { status: r.reason === "error" ? 502 : 409 });
    }
    const confirmed = Object.values(r.fields).filter((v) => v === "confirmed").length;
    if (confirmed === 0) {
      return NextResponse.json({
        error: tri(lang, "وردپرس درخواست را گرفت ولی هیچ‌کدام از فیلدهای سئو را ثبت نکرد (افزونه سئو آن‌ها را برای REST باز نکرده). متن را دستی جایگذاری کنید.", "WordPress accepted the request but stored none of the SEO fields (the SEO plugin doesn't expose them to REST). Please paste the text in manually.", "WordPress hat die Anfrage angenommen, aber keines der SEO-Felder gespeichert (das SEO-Plugin gibt sie nicht per REST frei). Bitte fügen Sie den Text manuell ein."),
        reason: "not_confirmed",
      }, { status: 409 });
    }
    return NextResponse.json({
      seoPlugin: r.seoPlugin, editUrl: r.editUrl,
      results: Object.entries(r.fields).map(([key, v]) => ({ field: key, applied: v === "confirmed" })),
      partial: confirmed < Object.keys(r.fields).length,
    });
  }

  if (conn.platform === "aifekr") {
    if (!websiteId) return NextResponse.json({ error: "شناسه‌ی سایت ساخته‌شده در AiFekr الزامی است" }, { status: 400 });
    const r = await applyToAiFekrSite(user.id, websiteId, title, metaDescription);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ results: r.results });
  }

  return NextResponse.json({ error: "اعمال خودکار برای این پلتفرم پشتیبانی نمی‌شود — تغییرات پیشنهادی را دستی اعمال کنید" }, { status: 400 });
}
