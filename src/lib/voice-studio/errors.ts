import {tri} from "@/lib/i18n/tri";
import type {Lang} from "@/lib/i18n";
export function voiceErrorMessage(code:string,lang:Lang){
 const messages:Record<string,[string,string,string,string]>={
 ELEVENLABS_PERMISSION_MODELS_READ:["کلید ElevenLabs مجوز Models → Read ندارد. این مجوز را در حساب ElevenLabs برای همان کلید فعال کنید.","The ElevenLabs key needs Models → Read in ElevenLabs key settings.","Der ElevenLabs-Schlüssel benötigt Models → Read.","ElevenLabs anahtarı Models → Read iznine ihtiyaç duyuyor."],
 ELEVENLABS_PERMISSION_USER_READ:["کلید ElevenLabs مجوز User → Read برای بررسی سهمیه ندارد. این مجوز باید در حساب ElevenLabs فعال شود.","The ElevenLabs key needs User → Read to check available quota.","Der ElevenLabs-Schlüssel benötigt User → Read zur Kontingentprüfung.","Kota kontrolü için ElevenLabs anahtarında User → Read izni gerekiyor."],
 ELEVENLABS_HTTP_403:["ElevenLabs اتصال این مسیر را رد کرده است؛ تنظیمات شبکه و مجوز IP را بررسی کنید.","ElevenLabs rejected this connection. Check the network and IP permissions.","ElevenLabs hat die Verbindung abgelehnt. Netzwerk und IP prüfen.","ElevenLabs bağlantıyı reddetti. Ağı ve IP izinlerini kontrol edin."],
 NO_SUPPORTED_VOICES_OR_MODELS:["فهرست مدل یا صدای سازگار خالی است؛ دسترسی کلید و حساب ElevenLabs را بررسی کنید.","No compatible models or voices were returned. Check key and account access.","Keine kompatiblen Modelle oder Stimmen verfügbar.","Uyumlu model veya ses bulunamadı. Hesap erişimini kontrol edin."],
 CATALOG_NOT_VERIFIED:["مدیر باید اتصال ElevenLabs را در تنظیمات استودیوی صدا تأیید کند.","An administrator must verify ElevenLabs in Voice Studio settings.","Die ElevenLabs-Verbindung muss in den Studio-Einstellungen bestätigt werden.","Yönetici Ses Stüdyosu ayarlarında ElevenLabs bağlantısını doğrulamalı."],
 CATALOG_EXPIRED:["فهرست صداها نیاز به به‌روزرسانی دارد؛ مدیر باید تست اتصال را اجرا کند.","The voice catalog needs refreshing. Ask an admin to run the connection test.","Der Stimmenkatalog muss aktualisiert werden.","Ses kataloğu yenilenmeli. Yönetici bağlantı testini çalıştırmalı."],
 };
 return messages[code]?tri(lang,...messages[code]):code;
}
