export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { generateListingCopy, type ListingCopyPlatform } from "@/lib/industry/realEstate/socialContentPack";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

const PLATFORMS: ListingCopyPlatform[] = ["instagram", "divar", "website"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "agent.listingCopywriter");
  if (!allowed) return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  const platformParam = req.nextUrl.searchParams.get("platform");
  const platform: ListingCopyPlatform = PLATFORMS.includes(platformParam as ListingCopyPlatform) ? (platformParam as ListingCopyPlatform) : "instagram";

  try {
    const result = await generateListingCopy(ws.workspaceUserId, params.id, lang === "fa" ? "fa" : "en", platform);
    if (!result) return NextResponse.json({ error: tri(lang, "تولید متن آگهی ناموفق بود", "Failed to generate listing copy", "Erstellung des Anzeigentexts fehlgeschlagen") }, { status: 500 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Listing Copywriter error:", err);
    return NextResponse.json({ error: tri(lang, "خطا در تولید متن آگهی", "Failed to generate listing copy", "Erstellung des Anzeigentexts fehlgeschlagen") }, { status: 500 });
  }
}
