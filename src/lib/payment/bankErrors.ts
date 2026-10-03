import { NextRequest,NextResponse } from "next/server";
import { tri } from "@/lib/i18n/tri";
const messages:Record<string,[string,string,string,string]>={
 "Unauthorized":["برای ادامه وارد حساب شوید.","Sign in to continue.","Bitte anmelden.","Devam etmek için giriş yapın."],
 "Forbidden":["این عملیات فقط برای ادمین است.","Administrator access required.","Administratorzugriff erforderlich.","Yönetici erişimi gerekli."],
 "Invalid request":["درخواست معتبر نیست.","Invalid request.","Ungültige Anfrage.","Geçersiz istek."],
 "Invalid plan":["پکیج معتبر یا فعال نیست.","Package is unavailable.","Paket nicht verfügbar.","Paket mevcut değil."],
 "Invalid billing period":["دوره اشتراک معتبر نیست.","Invalid billing period.","Ungültiger Abrechnungszeitraum.","Geçersiz abonelik dönemi."],
 "Too many requests":["درخواست‌های زیادی ارسال کرده‌اید؛ کمی صبر کنید.","Too many requests; please wait.","Zu viele Anfragen; bitte warten.","Çok fazla istek; lütfen bekleyin."],
 "Too many uploads":["تعداد آپلود زیاد است؛ کمی صبر کنید.","Too many uploads; please wait.","Zu viele Uploads; bitte warten.","Çok fazla yükleme; lütfen bekleyin."],
 "Bank account is unavailable":["اطلاعات حساب بانکی در دسترس نیست؛ با پشتیبانی تماس بگیرید.","Bank details unavailable; contact support.","Bankdaten nicht verfügbar; Support kontaktieren.","Banka bilgileri mevcut değil; destekle iletişime geçin."],
 "Package price unavailable":["قیمت این پکیج در دسترس نیست.","Package price unavailable.","Paketpreis nicht verfügbar.","Paket fiyatı mevcut değil."],
 "Student welcome offer already used":["آفر اولین اشتراک استفاده شده یا در انتظار پرداخت است؛ پلن ماهانه را انتخاب کنید.","Welcome offer already used or pending; choose the monthly package.","Willkommensangebot genutzt oder ausstehend; Monatstarif wählen.","İlk abonelik teklifi kullanılmış veya bekliyor; aylık paketi seçin."],
 "Maximum file size: 5 MB":["حجم رسید نباید بیشتر از ۵ مگابایت باشد.","Maximum receipt size: 5 MB.","Maximale Beleggröße: 5 MB.","En fazla dekont boyutu: 5 MB."],
 "Upload a JPG, PNG or PDF up to 5 MB":["یک رسید JPG، PNG یا PDF با حجم حداکثر ۵ مگابایت انتخاب کنید.","Choose a JPG, PNG or PDF up to 5 MB.","JPG, PNG oder PDF bis 5 MB auswählen.","En fazla 5 MB JPG, PNG veya PDF seçin."],
 "Invalid upload":["آپلود معتبر نیست؛ دوباره تلاش کنید.","Invalid upload; try again.","Ungültiger Upload; erneut versuchen.","Geçersiz yükleme; tekrar deneyin."],
 "Invalid file format":["فرمت فایل معتبر نیست؛ فقط JPG، PNG یا PDF پذیرفته می‌شود.","Invalid format; only JPG, PNG or PDF accepted.","Ungültiges Format; nur JPG, PNG oder PDF.","Geçersiz biçim; yalnızca JPG, PNG veya PDF."],
 "Receipt already submitted or payment unavailable":["رسید قبلاً ثبت شده یا این سفارش قابل پرداخت نیست.","Receipt already submitted or order unavailable.","Beleg bereits eingereicht oder Bestellung nicht verfügbar.","Dekont zaten gönderilmiş veya sipariş mevcut değil."],
 "This receipt was already submitted":["این رسید قبلاً برای یک سفارش ثبت شده است.","This receipt was already submitted for an order.","Dieser Beleg wurde bereits eingereicht.","Bu dekont daha önce gönderilmiş."],
 "Not found":["سفارش پیدا نشد.","Order not found.","Bestellung nicht gefunden.","Sipariş bulunamadı."],
 "NOT_REVIEWABLE":["این سفارش رسید قابل بررسی ندارد.","This order has no reviewable receipt.","Kein prüfbarer Beleg vorhanden.","İncelenebilir dekont yok."],
 "ALREADY_REVIEWED":["این سفارش قبلاً بررسی شده است.","Order already reviewed.","Bestellung bereits geprüft.","Sipariş zaten incelenmiş."],
};
export function bankError(req:NextRequest,message:string,status:number){const cookie=req.cookies.get("lang")?.value;const lang=cookie==="en"||cookie==="de"||cookie==="tr"?cookie:"fa";const value=messages[message];return NextResponse.json({error:value?tri(lang,...value):message,code:message},{status});}
