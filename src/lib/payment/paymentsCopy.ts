import type { Lang } from "@/lib/i18n/server";
import type { Four } from "@/lib/crm/crmCopy.extract";

/**
 * The payment history page for the new design: the classic page's wording (components/billing/PaymentsView.tsx).
 * Verbatim, keyed by English ({name} is filled in by the page). The test fails if this drifts.
 */
export const PAYMENTS_STRINGS: [string, Four][] = [
  ["Unable to load payment status", ["دریافت وضعیت ممکن نشد", "Unable to load payment status", "Zahlungsstatus nicht verfügbar", "Ödeme durumu yüklenemedi"]],
  ["Unable to load status", ["دریافت وضعیت ممکن نشد", "Unable to load status", "Status nicht verfügbar", "Durum yüklenemedi"]],
  ["Payments & activation", ["پرداخت‌ها و فعال‌سازی", "Payments & activation", "Zahlungen und Aktivierung", "Ödemeler ve etkinleştirme"]],
  ["Your orders and receipts stay here. Return through Payments in the menu, even after closing the page.", ["همهٔ سفارش‌ها و رسیدها اینجا محفوظ‌اند. حتی با بستن صفحه می‌توانی از همین بخش در منو پیگیری کنی.", "Your orders and receipts stay here. Return through Payments in the menu, even after closing the page.", "Bestellungen und Belege bleiben hier. Auch nach dem Schließen findest du sie unter Zahlungen im Menü.", "Sipariş ve dekontların burada saklanır. Sayfayı kapatsan da menüdeki Ödemeler bölümünden takip edebilirsin."]],
  ["{reviewCount} receipts awaiting review. No second payment needed.", ["{reviewCount} رسید در انتظار بررسی؛ پرداخت دوباره لازم نیست.", "{reviewCount} receipts awaiting review. No second payment needed.", "{reviewCount} Belege in Prüfung. Keine erneute Zahlung nötig.", "{reviewCount} dekont incelemede. Tekrar ödeme gerekmiyor."]],
  ["Payment filters", ["فیلتر پرداخت‌ها", "Payment filters", "Zahlungsfilter", "Ödeme filtreleri"]],
  ["All", ["همه", "All", "Alle", "Tümü"]],
  ["Pending", ["در انتظار", "Pending", "Ausstehend", "Bekliyor"]],
  ["Approved", ["تأییدشده", "Approved", "Bestätigt", "Onaylandı"]],
  ["Needs attention", ["نیاز به پیگیری", "Needs attention", "Handlungsbedarf", "İşlem gerekiyor"]],
  ["Refresh", ["به‌روزرسانی", "Refresh", "Aktualisieren", "Yenile"]],
  ["Loading orders…", ["در حال دریافت سفارش‌ها…", "Loading orders…", "Bestellungen werden geladen…", "Siparişler yükleniyor…"]],
  ["toman", ["تومان", "toman", "Toman", "toman"]],
  ["Student package", ["پکیج دانشجویی", "Student package", "Studierendenpaket", "Öğrenci paketi"]],
  ["AI calling", ["تماس هوش مصنوعی", "AI calling", "KI-Anrufe", "Yapay zekâ aramaları"]],
  ["AI credits", ["اعتبار هوش مصنوعی", "AI credits", "KI-Credits", "Yapay zekâ kredisi"]],
  ["Payment approved", ["پرداخت تأیید شده", "Payment approved", "Zahlung bestätigt", "Ödeme onaylandı"]],
  ["Receipt received · awaiting review", ["رسید دریافت شد؛ منتظر بررسی ادمین", "Receipt received · awaiting review", "Beleg erhalten · Prüfung ausstehend", "Dekont alındı · inceleme bekleniyor"]],
  ["Awaiting transfer or receipt", ["منتظر انتقال مبلغ یا ارسال رسید", "Awaiting transfer or receipt", "Überweisung oder Beleg ausstehend", "Havale veya dekont bekleniyor"]],
  ["Payment is not complete yet", ["پرداخت هنوز تکمیل نشده", "Payment is not complete yet", "Zahlung noch nicht abgeschlossen", "Ödeme henüz tamamlanmadı"]],
  ["Order cancelled by administrator", ["سفارش توسط ادمین لغو شده است", "Order cancelled by administrator", "Bestellung vom Administrator storniert", "Sipariş yönetici tarafından iptal edildi"]],
  ["Receipt not approved · read the review", ["رسید تأیید نشد؛ توضیح بررسی را بخوان", "Receipt not approved · read the review", "Beleg abgelehnt · Prüfhinweis lesen", "Dekont onaylanmadı · incelemeyi oku"]],
  ["Payment not completed · check its status", ["پرداخت تکمیل نشد؛ وضعیت را پیگیری کن", "Payment not completed · check its status", "Zahlung nicht abgeschlossen · Status prüfen", "Ödeme tamamlanmadı · durumunu kontrol et"]],
  ["No action needed. The result will appear here; do not pay again.", ["کار دیگری لازم نیست. نتیجه در همین بخش ثبت می‌شود؛ دوباره پرداخت نکن.", "No action needed. The result will appear here; do not pay again.", "Keine weitere Aktion nötig. Das Ergebnis erscheint hier; nicht erneut zahlen.", "Başka işlem gerekmiyor. Sonuç burada görünecek; tekrar ödeme yapma."]],
  ["Order reference & details", ["شناسه و جزئیات سفارش", "Order reference & details", "Bestellreferenz und Details", "Sipariş referansı ve ayrıntılar"]],
  ["Reference:", ["کد پیگیری:", "Reference:", "Referenz:", "Referans:"]],
  ["Receipt sent:", ["ارسال رسید:", "Receipt sent:", "Beleg gesendet:", "Dekont gönderildi:"]],
  ["Reviewed:", ["بررسی:", "Reviewed:", "Geprüft:", "İncelendi:"]],
  ["Track approval", ["پیگیری تأیید", "Track approval", "Freigabe verfolgen", "Onayı takip et"]],
  ["Continue payment & receipt", ["ادامهٔ پرداخت و رسید", "Continue payment & receipt", "Zahlung und Beleg fortsetzen", "Ödeme ve dekonta devam et"]],
  ["Payment details", ["جزئیات پرداخت", "Payment details", "Zahlungsdetails", "Ödeme ayrıntıları"]],
  ["Continue on Zarinpal", ["ادامهٔ پرداخت در زرین‌پال", "Continue on Zarinpal", "Bei Zarinpal fortsetzen", "Zarinpal'da devam et"]],
  ["Saved receipt", ["رسید ثبت‌شده", "Saved receipt", "Gespeicherter Beleg", "Kayıtlı dekont"]],
  ["Open my workspace", ["ورود به فضای من", "Open my workspace", "Meinen Bereich öffnen", "Alanıma git"]],
  ["Contact support", ["پیگیری با پشتیبانی", "Contact support", "Support kontaktieren", "Destekle iletişime geç"]],
  ["No orders yet", ["هنوز سفارشی ثبت نکرده‌ای", "No orders yet", "Noch keine Bestellungen", "Henüz sipariş yok"]],
  ["No orders with this status", ["سفارشی با این وضعیت نداری", "No orders with this status", "Keine Bestellungen mit diesem Status", "Bu durumda sipariş yok"]],
  ["View packages", ["مشاهدهٔ پکیج‌ها", "View packages", "Pakete ansehen", "Paketlere bak"]],
  ["Payment pages", ["صفحه‌های پرداخت", "Payment pages", "Zahlungsseiten", "Ödeme sayfaları"]],
  ["Newer", ["جدیدتر", "Newer", "Neuere", "Daha yeni"]],
  ["Older", ["قدیمی‌تر", "Older", "Ältere", "Daha eski"]],
  ["Always available: workspace menu → Payments & activation. Review results come from the server.", ["دسترسی ثابت: منوی پنل ← پرداخت‌ها و فعال‌سازی. نتیجهٔ بررسی از اطلاعات سرور خوانده می‌شود.", "Always available: workspace menu → Payments & activation. Review results come from the server.", "Immer erreichbar: Menü → Zahlungen und Aktivierung. Prüfergebnisse stammen vom Server.", "Kalıcı erişim: panel menüsü → Ödemeler ve etkinleştirme. İnceleme sonucu sunucudan alınır."]],
];

const COLUMN: Record<Lang, number> = { fa: 0, en: 1, de: 2, tr: 3 };
export function paymentsCopy(lang: Lang): Record<string, string> {
  const column = COLUMN[lang] ?? 1;
  return Object.fromEntries(PAYMENTS_STRINGS.map(([key, r]) => [key, r[column]]));
}
