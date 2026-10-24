export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

import { validIban } from "@/lib/payment/bank";

// Settings that decide where customer money goes or how much is paid out.
// Only a SUPER_ADMIN may change them; every change is audited.
const PAYMENT_SETTING = /^(zarinpal_|bank_|payment_gateway$|referral_commission_percent$|fitness_marketplace_commission_percent$)/;
const SETTING_KEY = /^[A-Za-z0-9_.-]{1,80}$/;

async function checkAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.siteSetting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) if (!["seoIntelligenceProvider","cloudflarePlatformConfig"].includes(s.key) && !s.key.startsWith("telnyx_") && !["vapi_private_key","vapi_webhook_secret"].includes(s.key)) map[s.key] = s.value;
  return NextResponse.json({ settings: map });
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { settings } = await req.json() as { settings: Record<string, string> };
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  for (const key of ["bank_iban", "bank_iban_eur"]) {
    if (settings[key] !== undefined && !validIban(String(settings[key]))) return NextResponse.json({error:"Invalid IBAN"},{status:400});
  }
  if (Object.hasOwn(settings, "seoIntelligenceProvider")) return NextResponse.json({ error: "Use the dedicated SEO provider settings endpoint" }, { status: 400 });
  if (Object.hasOwn(settings, "cloudflarePlatformConfig")) return NextResponse.json({ error: "Use the dedicated Cloudflare settings endpoint" }, { status: 400 });
  if(Object.keys(settings).some(key=>key.startsWith("telnyx_")||["vapi_private_key","vapi_webhook_secret"].includes(key)))return NextResponse.json({error:"Use dedicated voice provider settings"},{status:400});
  if (settings.creditCosts !== undefined) {
    try {
      const costs = JSON.parse(String(settings.creditCosts));
      if (!costs || typeof costs !== "object" || Array.isArray(costs) || Object.values(costs).some(value => !Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1000000)) throw new Error("Invalid costs");
    } catch { return NextResponse.json({ error: "Credit costs must be nonnegative whole numbers" }, { status: 400 }); }
  }
  const keys = Object.keys(settings);
  if (keys.some(key => !SETTING_KEY.test(key) || String(settings[key]).length > 100000)) return NextResponse.json({ error: "Invalid setting key or value" }, { status: 400 });
  const before = new Map((await prisma.siteSetting.findMany({ where: { key: { in: keys } } })).map(row => [row.key, row.value]));
  const changed = keys.filter(key => before.get(key) !== String(settings[key]));
  // Settings pages post the whole form, so only an actual change is gated.
  if (changed.some(key => PAYMENT_SETTING.test(key)) && user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a super admin can change payment settings", code: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
  await prisma.$transaction([
    ...keys.map(key => prisma.siteSetting.upsert({
      where: { key },
      update: { value: String(settings[key]) },
      create: { key, value: String(settings[key]) },
    })),
    ...(changed.length ? [prisma.auditLog.create({ data: { actorId: user.id, action: "site_settings_updated", metadata: JSON.stringify({ keys: changed, payment: changed.filter(key => PAYMENT_SETTING.test(key)).map(key => ({ key, from: before.get(key) ?? null, to: String(settings[key]) })) }) } })] : []),
  ]);

  return NextResponse.json({ success: true });
}
