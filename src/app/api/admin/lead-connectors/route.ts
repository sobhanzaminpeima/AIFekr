export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { metaSubscribePageLeadgen } from "@/lib/leadgen/meta";

// Admin view of every tenant's Meta lead-source rows, and the manual
// fulfilment path used while App Review is pending: the admin obtains the
// tenant's Page id + a Page access token (from the tenant, or via Graph API
// Explorer after being added to the Page), pastes them here, and this
// validates the token, subscribes the Page to the leadgen webhook, and flips
// the row to active.
const RELAY_BASE_URL = process.env.AI_RELAY_BASE_URL || "";
const GRAPH_BASE = RELAY_BASE_URL
  ? `${RELAY_BASE_URL}/facebook-graph/v21.0`
  : "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const rows = await prisma.leadSource.findMany({
    where: { provider: "meta" },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
  const byId = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userLabel: byId.get(r.userId)?.email || r.userId,
      userName: byId.get(r.userId)?.name || null,
      externalId: r.externalId,
      name: r.name,
      status: r.status,
      lastError: r.lastError,
      leadsImported: r.leadsImported,
      lastLeadAt: r.lastLeadAt,
      hasToken: !!r.accessToken,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const { id, pageId, pageToken } = await req.json().catch(() => ({}));
  if (!id || !pageId?.trim() || !pageToken?.trim()) {
    return NextResponse.json({ error: "id، pageId و pageToken الزامی است" }, { status: 400 });
  }

  const row = await prisma.leadSource.findUnique({ where: { id } });
  if (!row || row.provider !== "meta") return NextResponse.json({ error: "ردیف یافت نشد" }, { status: 404 });

  // Validate the token actually controls this Page.
  let pageName = row.name;
  try {
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(pageId.trim())}?fields=name&access_token=${encodeURIComponent(pageToken.trim())}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Graph ${res.status}`);
    pageName = data.name || pageName;
  } catch (e) {
    return NextResponse.json({ error: `توکن یا Page ID نامعتبر: ${e instanceof Error ? e.message : "?"}` }, { status: 400 });
  }

  // Point the (userId, provider) row at the real Page. If a stale row already
  // exists for this exact page under the same user, merge onto it.
  try {
    await prisma.leadSource.update({
      where: { id: row.id },
      data: {
        externalId: pageId.trim(),
        name: pageName,
        accessToken: pageToken.trim(),
        tokenExpiry: new Date(Date.now() + 60 * 86400000),
        status: "active",
        lastError: null,
      },
    });
  } catch {
    return NextResponse.json({ error: "این پیج قبلاً برای این کاربر ثبت شده" }, { status: 409 });
  }

  let warn: string | null = null;
  try {
    await metaSubscribePageLeadgen(pageId.trim(), pageToken.trim());
  } catch (e) {
    warn = `ردیف فعال شد ولی ثبت وبهوک ناموفق بود: ${e instanceof Error ? e.message : "?"}`;
    await prisma.leadSource.update({ where: { id: row.id }, data: { status: "error", lastError: warn } });
  }

  return NextResponse.json({ ok: true, warn });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });
  await prisma.leadSource.deleteMany({ where: { id, provider: "meta" } });
  return NextResponse.json({ ok: true });
}
