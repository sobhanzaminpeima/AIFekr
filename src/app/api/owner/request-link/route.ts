export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/resend";
import { signOwnerLinkToken } from "@/lib/auth/ownerAuth";

/**
 * Owner login step 1 (passwordless, matching how the owner already reaches
 * the platform — an emailed link, same as the statement-share link). Always
 * returns the same generic success message whether or not the email matches
 * an owner, so this can't be used to test which addresses are registered.
 */
export async function POST(req: NextRequest) {
  const { email, lang } = (await req.json().catch(() => ({}))) as { email?: string; lang?: "fa" | "en" | "de" };
  const L = lang === "en" ? "en" : lang === "de" ? "de" : "fa";
  const generic = NextResponse.json({
    message:
      L === "fa" ? "اگر این ایمیل مالک ملکی باشد، لینک ورود برایش ارسال شد."
      : L === "de" ? "Falls diese E-Mail-Adresse einem Eigentümer gehört, wurde ein Login-Link gesendet."
      : "If this email belongs to a property owner, a login link has been sent.",
  });

  if (!email || typeof email !== "string") return generic;

  // ownerContactId is a plain string field, not a Prisma relation (see
  // Property model) — so "does this contact own any property" is a
  // separate existence check, not a nested `where`. Case-insensitive match
  // via LOWER() since SQLite's Prisma provider has no `mode: "insensitive"`.
  const rows = await prisma.$queryRaw<{ id: string; name: string; email: string }[]>`
    SELECT id, name, email FROM "CrmContact" WHERE LOWER(email) = LOWER(${email.trim()}) LIMIT 1
  `;
  const contact = rows[0];
  if (!contact || !contact.email) return generic;

  const ownsAny = await prisma.property.findFirst({ where: { ownerContactId: contact.id }, select: { id: true } });
  if (!ownsAny) return generic;

  const token = signOwnerLinkToken(contact.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  // The actual handler lives at /api/owner/verify (route.ts under src/app/api/),
  // not /owner/verify -- there is no page at that path, so the link 404'd for
  // every single owner who tried to log in until this was caught.
  const link = `${appUrl}/api/owner/verify?token=${token}`;

  const subject =
    L === "fa" ? "لینک ورود به پنل مالک" : L === "de" ? "Ihr Login-Link für das Eigentümerportal" : "Your owner portal login link";
  const cta = L === "fa" ? "ورود به پنل" : L === "de" ? "Zum Portal" : "Open the portal";
  const dir = L === "fa" ? "rtl" : "ltr";
  // The email used to be just a greeting and a button, with nothing saying
  // WHAT the link opens or WHY the owner is getting it -- confusing for
  // someone who requested this once and won't remember the flow.
  const intro =
    L === "fa"
      ? `شما (یا کسی با دسترسی به این ایمیل) درخواست ورود به پنل مالک در ${process.env.NEXT_PUBLIC_APP_NAME || "AiFekr"} را ثبت کرده است. با کلیک روی دکمهٔ زیر، بدون نیاز به رمز عبور وارد می‌شوید و می‌توانید تمام گزارش‌های تسویهٔ ماهانهٔ ملک(های) خود را ببینید.`
      : L === "de"
      ? `Jemand (hoffentlich Sie) hat einen Login-Link für das Eigentümerportal von ${process.env.NEXT_PUBLIC_APP_NAME || "AiFekr"} angefordert. Klicken Sie auf die Schaltfläche unten, um sich ohne Passwort anzumelden und alle monatlichen Abrechnungen für Ihre Immobilie(n) einzusehen.`
      : `Someone (hopefully you) requested a login link for the ${process.env.NEXT_PUBLIC_APP_NAME || "AiFekr"} owner portal. Click the button below to sign in without a password and see every monthly statement for your property/properties.`;
  const ignoreNote =
    L === "fa" ? "اگر این درخواست را شما نفرستاده‌اید، این ایمیل را نادیده بگیرید — هیچ تغییری در حسابتان ایجاد نمی‌شود."
    : L === "de" ? "Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail einfach — an Ihrem Konto ändert sich nichts."
    : "If you didn't request this, just ignore this email — nothing about your account will change.";
  const html = `
    <div dir="${dir}" style="font-family:Tahoma,Arial;padding:24px;max-width:480px;">
      <p>${L === "fa" ? "سلام" : L === "de" ? "Hallo" : "Hi"} ${contact.name},</p>
      <p style="color:#444;line-height:1.6;">${intro}</p>
      <p style="margin:20px 0;">
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;border-radius:8px;text-decoration:none;">${cta}</a>
      </p>
      <p style="color:#888;font-size:12px;">${L === "fa" ? "این لینک ۲۰ دقیقه معتبر است." : L === "de" ? "Dieser Link ist 20 Minuten gültig." : "This link expires in 20 minutes."}</p>
      <p style="color:#aaa;font-size:11px;margin-top:16px;border-top:1px solid #eee;padding-top:12px;">${ignoreNote}</p>
    </div>`;

  await sendEmail(contact.email, subject, html);
  return generic;
}
