import { prisma } from "@/lib/db/prisma";

/**
 * Mandatory mobile number (owner decision 2026-11-06). SiteSetting
 * `phoneRequirement` = {"enabled": boolean}; a missing or unreadable row means
 * ON. A super admin can switch it off in Admin → Settings as an instant rollback:
 * then registration accepts email-only again and nobody is sent to /complete-phone.
 * Admins are never gated, so they can always reach the panel.
 */
export const PHONE_REQUIREMENT_KEY = "phoneRequirement";
export const COMPLETE_PHONE_PATH = "/complete-phone";
const EXEMPT_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

let cache: { at: number; enabled: boolean } | null = null;
export const clearPhoneRequirementCache = () => { cache = null; };

export async function phoneRequired(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 30_000) return cache.enabled;
  let enabled = true;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: PHONE_REQUIREMENT_KEY } });
    if (row) enabled = JSON.parse(row.value)?.enabled !== false;
  } catch { enabled = true; }
  cache = { at: Date.now(), enabled };
  return enabled;
}

/** Pure rule, so it is unit-tested: who must add a number before continuing. */
export function mustCompletePhone(user: { phone: string | null; role: string }, enabled: boolean): boolean {
  return enabled && !user.phone && !EXEMPT_ROLES.has(user.role);
}

export async function savePhoneRequirement(enabled: boolean, actorId: string) {
  await prisma.$transaction([
    prisma.siteSetting.upsert({ where: { key: PHONE_REQUIREMENT_KEY }, create: { key: PHONE_REQUIREMENT_KEY, value: JSON.stringify({ enabled }) }, update: { value: JSON.stringify({ enabled }) } }),
    prisma.auditLog.create({ data: { actorId, action: "phone_requirement_updated", metadata: JSON.stringify({ enabled }) } }),
  ]);
  cache = { at: Date.now(), enabled };
}

/** Four-language copy shared by the API errors and the classic page (the new design carries the same text). */
export const PHONE_COPY = {
  fa: { title: "شماره موبایل خود را وارد کنید", body: "برای ادامه، شماره موبایلتان لازم است. از آن برای امنیت حساب و پیام‌های مهم استفاده می‌شود.", country: "کشور", phone: "شماره موبایل", save: "ذخیره و ادامه", required: "شماره موبایل الزامی است", invalid: "شماره موبایل معتبر وارد کنید", taken: "این شماره موبایل قبلاً برای حساب دیگری ثبت شده است", tooMany: "تعداد تلاش زیاد است؛ کمی بعد دوباره امتحان کنید", saved: "ذخیره شد", logout: "خروج از حساب" },
  en: { title: "Add your mobile number", body: "Your mobile number is required to continue. It is used for account security and important messages.", country: "Country", phone: "Mobile number", save: "Save and continue", required: "A mobile number is required", invalid: "Enter a valid mobile number", taken: "This mobile number is already registered to another account", tooMany: "Too many attempts; please try again shortly", saved: "Saved", logout: "Sign out" },
  de: { title: "Handynummer hinzufügen", body: "Um fortzufahren, benötigen wir Ihre Handynummer. Sie dient der Kontosicherheit und wichtigen Nachrichten.", country: "Land", phone: "Handynummer", save: "Speichern und weiter", required: "Eine Handynummer ist erforderlich", invalid: "Geben Sie eine gültige Handynummer ein", taken: "Diese Handynummer ist bereits einem anderen Konto zugeordnet", tooMany: "Zu viele Versuche; bitte versuchen Sie es gleich noch einmal", saved: "Gespeichert", logout: "Abmelden" },
  tr: { title: "Cep telefonu numaranızı ekleyin", body: "Devam etmek için cep telefonu numaranız gerekli. Hesap güvenliği ve önemli mesajlar için kullanılır.", country: "Ülke", phone: "Cep telefonu", save: "Kaydet ve devam et", required: "Cep telefonu numarası gerekli", invalid: "Geçerli bir cep telefonu numarası girin", taken: "Bu numara başka bir hesaba kayıtlı", tooMany: "Çok fazla deneme; lütfen biraz sonra tekrar deneyin", saved: "Kaydedildi", logout: "Çıkış yap" },
} as const;
export type PhoneLang = keyof typeof PHONE_COPY;
export const phoneLang = (l: string | null | undefined): PhoneLang => (l === "en" || l === "de" || l === "tr" ? l : "fa");
