export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { parseDirectDeliveryOptions } from "@/lib/instagram/directDelivery";

async function loadOwnedRule(userId: string, businessId: string | null, id: string) {
  return prisma.instagramDirectRule.findFirst({ where: { id, userId, ...instagramWorkspaceScope(businessId) } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const businessId = await activeBusinessIdFor(user.id);
  const { id } = await params;
  const rule = await loadOwnedRule(user.id, businessId, id);
  if (!rule) return NextResponse.json({ error: "قانون یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }
  const data: { isActive?: boolean; name?: string; response?: string; followGateEnabled?: boolean; typingIndicatorEnabled?: boolean; delayMinSeconds?: number; delayMaxSeconds?: number } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 100);
  if (typeof body.response === "string" && body.response.trim()) data.response = body.response.trim().slice(0, 1000);
  const optionKeys = ["followGateEnabled", "typingIndicatorEnabled", "delayMinSeconds", "delayMaxSeconds"];
  if (optionKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
    const delivery = parseDirectDeliveryOptions({
      followGateEnabled: body.followGateEnabled ?? rule.followGateEnabled,
      typingIndicatorEnabled: body.typingIndicatorEnabled ?? rule.typingIndicatorEnabled,
      delayMinSeconds: body.delayMinSeconds ?? rule.delayMinSeconds,
      delayMaxSeconds: body.delayMaxSeconds ?? rule.delayMaxSeconds,
    });
    if (!delivery) return NextResponse.json({ error: "گزینه‌های ارسال دایرکت معتبر نیستند" }, { status: 400 });
    if (body.followGateEnabled !== undefined) data.followGateEnabled = delivery.followGateEnabled;
    if (body.typingIndicatorEnabled !== undefined) data.typingIndicatorEnabled = delivery.typingIndicatorEnabled;
    if (body.delayMinSeconds !== undefined) data.delayMinSeconds = delivery.delayMinSeconds;
    if (body.delayMaxSeconds !== undefined) data.delayMaxSeconds = delivery.delayMaxSeconds;
  }
  const updated = await prisma.instagramDirectRule.update({ where: { id }, data });
  return NextResponse.json({ rule: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const businessId = await activeBusinessIdFor(user.id);
  const { id } = await params;
  const rule = await loadOwnedRule(user.id, businessId, id);
  if (!rule) return NextResponse.json({ error: "قانون یافت نشد" }, { status: 404 });
  await prisma.instagramDirectRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
