export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { UI_PREVIEW_COOKIE, UI_THEME_SETTING, V2_ROUTES, forgetSiteUiTheme, isUiTheme, siteUiTheme, v2Available, v2Origin } from "@/lib/theme/uiTheme";

async function state(req: NextRequest) {
  const preview = req.cookies.get(UI_PREVIEW_COOKIE)?.value;
  return { active: await siteUiTheme(), preview: isUiTheme(preview) ? preview : null, v2Configured: !!v2Origin(), v2Healthy: await v2Available(), readyRoutes: V2_ROUTES };
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return unauthorizedResponse(req);
  return NextResponse.json(await state(req), { headers: { "Cache-Control": "no-store" } });
}

const body = z.object({ active: z.enum(["classic", "v2"]).optional(), preview: z.enum(["classic", "v2"]).nullable().optional() }).strict();

/**
 * active: the theme every visitor sees (SUPER_ADMIN only, audited).
 * preview: this admin's own browser only; null clears it.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const { active, preview } = parsed.data;
  if (active !== undefined) {
    if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ code: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
    const before = await siteUiTheme();
    await prisma.$transaction([
      prisma.siteSetting.upsert({ where: { key: UI_THEME_SETTING }, create: { key: UI_THEME_SETTING, value: active }, update: { value: active } }),
      prisma.auditLog.create({ data: { actorId: admin.id, action: "ui_theme_changed", targetId: UI_THEME_SETTING, metadata: JSON.stringify({ before, after: active }) } }),
    ]);
    forgetSiteUiTheme();
  }
  const current = await state(req);
  const res = NextResponse.json(preview === undefined ? current : { ...current, preview });
  if (preview === null) res.cookies.delete(UI_PREVIEW_COOKIE);
  else if (preview) res.cookies.set(UI_PREVIEW_COOKIE, preview, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 3600 });
  return res;
}
