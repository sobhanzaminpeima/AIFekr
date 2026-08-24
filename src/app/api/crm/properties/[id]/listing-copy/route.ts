export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { generateListingCopy, type ListingCopyPlatform } from "@/lib/industry/realEstate/socialContentPack";
import { getServerLang } from "@/lib/i18n/server";

const PLATFORMS: ListingCopyPlatform[] = ["instagram", "divar", "website"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "agent.listingCopywriter");
  if (!allowed) return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const platformParam = req.nextUrl.searchParams.get("platform");
  const platform: ListingCopyPlatform = PLATFORMS.includes(platformParam as ListingCopyPlatform) ? (platformParam as ListingCopyPlatform) : "instagram";
  const lang = await getServerLang();

  try {
    const result = await generateListingCopy(ws.workspaceUserId, params.id, lang === "fa" ? "fa" : "en", platform);
    if (!result) return NextResponse.json({ error: lang === "fa" ? "تولید متن آگهی ناموفق بود" : "Failed to generate listing copy" }, { status: 500 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Listing Copywriter error:", err);
    return NextResponse.json({ error: lang === "fa" ? "خطا در تولید متن آگهی" : "Failed to generate listing copy" }, { status: 500 });
  }
}
