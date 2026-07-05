export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

interface ApplyResult {
  field: string;
  applied: boolean;
  note?: string;
}

async function applyToWordPress(
  conn: { siteUrl: string | null; wpUsername: string | null; wpAppPassword: string | null },
  url: string,
  title?: string,
  metaDescription?: string
): Promise<{ ok: boolean; results: ApplyResult[]; error?: string }> {
  if (!conn.siteUrl || !conn.wpUsername || !conn.wpAppPassword) {
    return { ok: false, results: [], error: "اتصال وردپرس کامل نیست" };
  }
  const base = conn.siteUrl.replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${conn.wpUsername}:${conn.wpAppPassword}`).toString("base64");
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";

  // WordPress core doesn't expose a search-by-full-URL endpoint, so we
  // look the entry up by slug across both posts and pages.
  let found: { id: number; type: "posts" | "pages" } | null = null;
  for (const type of ["posts", "pages"] as const) {
    const res = await fetch(`${base}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}`, {
      headers: { Authorization: auth },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      found = { id: data[0].id, type };
      break;
    }
  }

  if (!found) {
    return { ok: false, results: [], error: "این صفحه در وردپرس پیدا نشد (slug مطابقتی نداشت)" };
  }

  const results: ApplyResult[] = [];
  const body: Record<string, unknown> = {};
  if (title) body.title = title;
  if (metaDescription) {
    // Best-effort: only applies if an SEO plugin (Yoast/RankMath) has
    // registered these meta keys with show_in_rest — WordPress silently
    // ignores unregistered meta keys rather than erroring, so we can't be
    // fully sure this landed without a follow-up read.
    body.meta = { rank_math_description: metaDescription, _yoast_wpseo_metadesc: metaDescription };
  }

  const patchRes = await fetch(`${base}/wp-json/wp/v2/${found.type}/${found.id}`, {
    method: "POST", // WP REST uses POST for partial update, not PATCH
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!patchRes.ok) {
    const err = await patchRes.text();
    return { ok: false, results: [], error: `وردپرس این تغییر را رد کرد: ${err.slice(0, 200)}` };
  }

  if (title) results.push({ field: "title", applied: true });
  if (metaDescription) results.push({ field: "metaDescription", applied: true, note: "فقط در صورتی اعمال می‌شود که افزونه‌ی سئوی سایت (Yoast/RankMath) این فیلد را برای REST API فعال کرده باشد" });

  return { ok: true, results };
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

  const { url, title, metaDescription, websiteId } = await req.json();

  const conn = await prisma.seoConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "ابتدا پلتفرم وبسایت خود را در بالای صفحه متصل کنید" }, { status: 400 });

  if (conn.platform === "wordpress") {
    if (!url) return NextResponse.json({ error: "آدرس صفحه الزامی است" }, { status: 400 });
    const r = await applyToWordPress(conn, url, title, metaDescription);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json({ results: r.results });
  }

  if (conn.platform === "aifekr") {
    if (!websiteId) return NextResponse.json({ error: "شناسه‌ی سایت ساخته‌شده در AiFekr الزامی است" }, { status: 400 });
    const r = await applyToAiFekrSite(user.id, websiteId, title, metaDescription);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ results: r.results });
  }

  return NextResponse.json({ error: "اعمال خودکار برای این پلتفرم پشتیبانی نمی‌شود — تغییرات پیشنهادی را دستی اعمال کنید" }, { status: 400 });
}
