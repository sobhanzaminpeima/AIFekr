export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const [full, teamMembership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, name: true, firstName: true, lastName: true, country: true, currency: true,
        email: true, phone: true, avatar: true,
        plan: true, credits: true, planExpiry: true, createdAt: true,
        authProvider: true,
      },
    }),
    // A team member's real, spendable balance is the shared team pool, not
    // their own User.credits — same rule the dashboard sidebar already
    // applies, duplicated here so /credits shows the exact same number
    // instead of a second, different-looking "balance" on another page.
    prisma.teamMember.findUnique({ where: { userId: user.id }, include: { team: { select: { credits: true } } } }),
  ]);

  const displayCredits = teamMembership?.team.credits ?? full?.credits ?? 0;

  return NextResponse.json({ user: full ? { ...full, displayCredits } : full });
}

const VALID_CURRENCIES = new Set(["IRT", "USD", "EUR"]);
const VALID_LANGS = new Set(["fa", "en", "de"]);

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { name, firstName, lastName, country, currency, language, avatar } = await req.json();
  const data: { name?: string; firstName?: string | null; lastName?: string | null; country?: string | null; currency?: string | null; language?: string; avatar?: string } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim().slice(0, 60);
  if (typeof firstName === "string") data.firstName = firstName.trim().slice(0, 60) || null;
  if (typeof lastName === "string") data.lastName = lastName.trim().slice(0, 60) || null;
  if (typeof country === "string") data.country = country.trim().slice(0, 10) || null;
  if (currency === null || (typeof currency === "string" && (currency === "" || VALID_CURRENCIES.has(currency)))) {
    data.currency = currency || null;
  }
  // Called (best-effort, fire-and-forget) by LanguageSwitcher on every
  // change -- so the choice survives to the NEXT login too, not just this
  // browser's cookie (see login/route.ts, which restores from this field).
  if (VALID_LANGS.has(language)) data.language = language;
  if (typeof avatar === "string") data.avatar = avatar.slice(0, 500);

  // Keep the legacy `name` column in sync -- same rule as the admin panel's
  // updateUserAsAdmin, so every existing caller reading user.name (most of
  // the app) doesn't go stale just because someone edited first/last name here.
  if (("firstName" in data || "lastName" in data) && !("name" in data)) {
    const first = data.firstName !== undefined ? data.firstName : user.name?.split(" ")[0];
    const last = data.lastName !== undefined ? data.lastName : undefined;
    const composed = [first, last].filter((s) => s && s.trim()).join(" ");
    if (composed) data.name = composed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "چیزی برای ذخیره وجود ندارد" }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ success: true, user: { name: updated.name, firstName: updated.firstName, lastName: updated.lastName, country: updated.country, currency: updated.currency, avatar: updated.avatar } });
}
