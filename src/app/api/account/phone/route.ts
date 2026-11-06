import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";
import { COUNTRIES, registrationPhone } from "@/lib/constants/countries";
import { findUserByPhone } from "@/lib/repositories/userRepository";
import { getServerLang } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/utils/rateLimit";
import { safeInternalPath } from "@/lib/growth/attribution";
import { COMPLETE_PHONE_PATH, PHONE_COPY, mustCompletePhone, phoneLang, phoneRequired } from "@/lib/auth/phoneRequirement";

export const dynamic = "force-dynamic";

/** The required-phone step: whether it applies, the country list and the localized copy. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lang = phoneLang(await getServerLang());
  return NextResponse.json({
    required: mustCompletePhone(user, await phoneRequired()), hasPhone: !!user.phone, lang,
    copy: PHONE_COPY[lang],
    countries: COUNTRIES.map(c => ({ code: c.code, name: c[lang] ?? c.en, dialCode: c.dialCode })),
  });
}

/**
 * Saves the signed-in user's mobile number once. Same normalisation as
 * registration (Iranian numbers 09xxxxxxxxx, others E.164), unique per account.
 * An existing number is never overwritten here (changing it is a support task).
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const lang = phoneLang(typeof body?.lang === "string" ? body.lang : await getServerLang()), copy = PHONE_COPY[lang];
  if (!rateLimit(`complete-phone:${user.id}`, 10, 10 * 60_000).allowed) return NextResponse.json({ error: copy.tooMany }, { status: 429 });
  const next = safeInternalPath(typeof body?.redirect === "string" ? body.redirect : "") ;
  const to = next && !next.startsWith(COMPLETE_PHONE_PATH) ? next : "/home";
  if (user.phone) return NextResponse.json({ ok: true, redirect: to });
  const country = typeof body?.country === "string" && COUNTRIES.some(c => c.code === body.country) ? body.country : "";
  if (!country || typeof body?.phone !== "string" || !body.phone.trim()) return NextResponse.json({ error: copy.required }, { status: 400 });
  let phone: string;
  try { phone = registrationPhone(body.phone, country); } catch { return NextResponse.json({ error: copy.invalid }, { status: 400 }); }
  if (!phone) return NextResponse.json({ error: copy.required }, { status: 400 });
  const other = await findUserByPhone(phone);
  if (other && other.id !== user.id) return NextResponse.json({ error: copy.taken }, { status: 409 });
  try {
    // Only fills an empty number: a parallel request can never replace one.
    const r = await prisma.user.updateMany({ where: { id: user.id, phone: null }, data: { phone } });
    if (!r.count) return NextResponse.json({ ok: true, redirect: to });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: copy.taken }, { status: 409 });
    throw e;
  }
  return NextResponse.json({ ok: true, redirect: to });
}
