import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";

/**
 * Sign-up wording that is not in the translation dictionaries. Shared by the
 * classic register page and the new design, so both say exactly the same.
 */
export function registerExtraCopy(lang: Lang) {
  return {
    promoLabel: tri(lang, "کد دعوت / Promo (اختیاری)", "Invitation / promo code (optional)", "Einladungs- / Promo-Code (optional)", "Davet / promosyon kodu (isteğe bağlı)"),
    promoHint: tri(lang, "کد و لینک رفرال یکسان‌اند؛ تخفیف فعال برای اولین خرید در پرداخت نمایش داده می‌شود.", "Code and referral link share the same attribution. Any active welcome discount appears at checkout.", "Code und Empfehlungslink nutzen dieselbe Zuordnung. Ein aktiver Willkommensrabatt erscheint beim Kauf.", "Kod ve referans bağlantısı aynı davet sahibine bağlanır. Etkin ilk satın alma indirimi ödeme adımında gösterilir."),
    accountType: tri(lang, "نوع حساب", "Account type", "Kontotyp", "Hesap türü"),
    accountTypes: {
      FITNESS: "AIFekr FIT",
      PERSONAL: tri(lang, "شخصی", "Personal", "Privat", "Kişisel"),
      STUDENT: tri(lang, "دانشجو", "Student", "Studierende", "Öğrenci"),
      BUSINESS: tri(lang, "کسب‌وکار", "Business", "Unternehmen", "İşletme"),
    },
    phoneInvalid: tri(lang, "شماره موبایل معتبر وارد کنید", "Enter a valid phone number", "Gültige Telefonnummer eingeben", "Geçerli telefon numarası girin"),
    marketingConsent: tri(lang, "راهنماها و پیشنهادهای مفید AIFekr را برایم ایمیل کنید (اختیاری، هر زمان قابل لغو).", "Email me useful AIFekr guides and offers (optional, unsubscribe anytime).", "Senden Sie mir hilfreiche AIFekr-Tipps und Angebote per E-Mail (optional, jederzeit abbestellbar).", "Bana faydalı AIFekr rehberleri ve teklifleri e-postayla gönder (isteğe bağlı, istediğiniz zaman iptal)."),
  };
}
