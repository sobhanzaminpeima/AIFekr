export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

import { validIban } from "@/lib/payment/bank";

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
  for (const s of settings) if (s.key !== "seoIntelligenceProvider") map[s.key] = s.value;
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
  if (settings.creditCosts !== undefined) {
    try {
      const costs = JSON.parse(String(settings.creditCosts));
      if (!costs || typeof costs !== "object" || Array.isArray(costs) || Object.values(costs).some(value => !Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1000000)) throw new Error("Invalid costs");
    } catch { return NextResponse.json({ error: "Credit costs must be nonnegative whole numbers" }, { status: 400 }); }
  }
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  return NextResponse.json({ success: true });
}
