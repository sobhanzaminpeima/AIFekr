import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { BusinessRequiredError, PeriodLockedError, UnbalancedEntryError, UnknownAccountError } from "./ledger";

/** The ledger's refusals in the reader's language, for routes that post entries a person typed. */
export function ledgerErrorMessage(err: unknown, lang: Lang): string {
  if (err instanceof UnbalancedEntryError) return tri(lang, "جمع بدهکار و بستانکار سند برابر نیست", "The entry's debits and credits do not balance", "Soll und Haben der Buchung sind nicht ausgeglichen", "Kaydın borç ve alacak toplamları eşit değil");
  if (err instanceof PeriodLockedError) return tri(lang, "دورهٔ مالی این تاریخ بسته است", "The fiscal period for this date is closed", "Die Geschäftsperiode dieses Datums ist abgeschlossen", "Bu tarihin mali dönemi kapalı");
  if (err instanceof UnknownAccountError) return tri(lang, "یکی از حساب‌های سند در دفتر حساب‌ها نیست", "One of the entry's accounts is not in the chart of accounts", "Ein Konto der Buchung ist nicht im Kontenplan", "Kayıttaki hesaplardan biri hesap planında yok");
  if (err instanceof BusinessRequiredError) return tri(lang, "ابتدا کسب‌وکار فعال را انتخاب کنید", "Choose the active business first", "Wählen Sie zuerst das aktive Unternehmen", "Önce aktif işletmeyi seçin");
  if (err instanceof Error && /already been reversed/.test(err.message)) return tri(lang, "این سند قبلاً برگشت خورده است", "This entry has already been reversed", "Diese Buchung wurde bereits storniert", "Bu kayıt zaten ters çevrildi");
  if (err instanceof Error && /at least two lines|non-zero|both debit and credit|cannot be negative/.test(err.message)) return tri(lang, "هر سند حداقل دو ردیف دارد و هر ردیف فقط بدهکار یا فقط بستانکار با مبلغ مثبت است", "An entry needs at least two lines, each with either a positive debit or a positive credit", "Eine Buchung braucht mindestens zwei Zeilen mit jeweils positivem Soll oder Haben", "Bir kayıt en az iki satır gerektirir; her satırda yalnızca pozitif borç veya alacak olmalı");
  return tri(lang, "ثبت سند انجام نشد", "The entry could not be posted", "Die Buchung konnte nicht gebucht werden", "Kayıt yapılamadı");
}
