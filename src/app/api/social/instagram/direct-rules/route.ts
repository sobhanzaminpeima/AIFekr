export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { canAutoPublish } from "@/lib/utils/planGates";
import { parseDirectDeliveryOptions } from "@/lib/instagram/directDelivery";

const MAX_RULES = 50;

function normalizeKeywords(value: unknown): string {
  return String(value || "")
    .split(/[,،]/)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20)
    .join(", ");
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const businessId = await activeBusinessIdFor(user.id);
  const scope = { userId: user.id, ...instagramWorkspaceScope(businessId) };
  const [rules, recentMessages] = await Promise.all([
    prisma.instagramDirectRule.findMany({ where: scope, orderBy: { createdAt: "desc" } }),
    prisma.instagramDirectMessageLog.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({ rules, recentMessages, canUseAutoDirect: canAutoPublish(user.plan) });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!canAutoPublish(user.plan)) {
    return NextResponse.json({ error: "Auto Direct فقط برای پلن‌های Pro و Team فعال است" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }
  const delivery = parseDirectDeliveryOptions(body);
  if (!delivery) return NextResponse.json({ error: "بازه تأخیر باید بین ۰ تا ۵ ثانیه باشد" }, { status: 400 });
  const triggerType = body.triggerType === "all_messages" || body.triggerType === "ai_fallback" ? body.triggerType : "keyword";
  const keywords = normalizeKeywords(body.keywords);
  const name = String(body.name || "").trim().slice(0, 100);
  const response = String(body.response || "").trim().slice(0, 1000);
  if (!name || !response || (triggerType === "keyword" && !keywords)) {
    return NextResponse.json({ error: "نام، پاسخ و حداقل یک کلمه کلیدی الزامی است" }, { status: 400 });
  }

  const businessId = await activeBusinessIdFor(user.id);
  const scope = { userId: user.id, ...instagramWorkspaceScope(businessId) };
  const connection = await prisma.instagramConnection.findFirst({ where: scope });
  if (!connection) return NextResponse.json({ error: "اینستاگرام متصل نیست" }, { status: 400 });
  const count = await prisma.instagramDirectRule.count({ where: scope });
  if (count >= MAX_RULES) return NextResponse.json({ error: `حداکثر ${MAX_RULES} قانون برای هر کسب‌وکار مجاز است` }, { status: 422 });

  if (triggerType !== "keyword") {
    const fallback = await prisma.instagramDirectRule.findFirst({ where: { ...scope, triggerType: { in: ["all_messages", "ai_fallback"] } } });
    if (fallback) return NextResponse.json({ error: "برای هر کسب‌وکار فقط یک قانون پیش‌فرض مجاز است" }, { status: 409 });
  }

  const rule = await prisma.instagramDirectRule.create({
    data: { userId: user.id, businessId, name, triggerType, keywords, response, ...delivery },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
