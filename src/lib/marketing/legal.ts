import type { Lang } from "@/lib/i18n/server";
import { copy, text, type Copy } from "./catalog";

/** Legal pages' text, shared by the classic pages and the new design (site API), so both show the same wording. */
export type LegalSection = { title: string; body: string };

const PRIVACY_FA: LegalSection[] = [
  {
    title: "۱. اطلاعاتی که جمع‌آوری می‌کنیم",
    body: "هنگام ثبت‌نام: نام، ایمیل یا شماره موبایل، و رمز عبور (به‌صورت هش‌شده و غیرقابل بازیابی ذخیره می‌شود). هنگام استفاده از خدمات: پیام‌های چت، محتوای تولیدشده، و لاگ مصرف اعتبار. هنگام پرداخت: اطلاعات تراکنش از طریق درگاه زرین‌پال (اطلاعات کارت بانکی شما هرگز روی سرورهای AiFekr ذخیره نمی‌شود). در صورت اتصال اختیاری حساب‌های شخص ثالث (وردپرس، اینستاگرام): توکن دسترسی محدود (Application Password یا Access Token) که فقط برای انجام عملیات درخواستی شما استفاده می‌شود.",
  },
  {
    title: "۲. نحوه‌ی استفاده از اطلاعات",
    body: "اطلاعات شما صرفاً برای ارائه و بهبود خدمات، پردازش پرداخت، ارسال اعلان‌های ضروری (تایید حساب، رسید پرداخت)، و پشتیبانی فنی استفاده می‌شود. پیام‌های چت شما ممکن است برای پردازش به provider های هوش مصنوعی (مانند Anthropic، DeepSeek، OpenAI) ارسال شوند تا پاسخ تولید شود؛ این ارسال فقط برای تولید پاسخ لحظه‌ای است.",
  },
  {
    title: "۳. اشتراک‌گذاری اطلاعات",
    body: "AiFekr اطلاعات شخصی شما را به هیچ شخص ثالثی برای اهداف تبلیغاتی نمی‌فروشد یا اجاره نمی‌دهد. اطلاعات فقط در موارد زیر با اشخاص ثالث در میان گذاشته می‌شود: (الف) provider های هوش مصنوعی برای پردازش درخواست شما، (ب) درگاه پرداخت زرین‌پال برای تکمیل تراکنش، (ج) در صورت الزام قانونی توسط مراجع ذی‌صلاح.",
  },
  {
    title: "۴. امنیت اطلاعات",
    body: "رمز عبور شما با الگوریتم هش یک‌طرفه ذخیره می‌شود و حتی تیم فنی AiFekr به آن دسترسی ندارد. ارتباط بین مرورگر شما و سرورهای AiFekr از طریق HTTPS رمزنگاری می‌شود. توکن‌های اتصال به حساب‌های شخص ثالث (وردپرس/اینستاگرام) در پایگاه‌داده‌ی داخلی نگهداری می‌شوند و در هیچ پاسخ API به‌صورت کامل نمایش داده نمی‌شوند.",
  },
  {
    title: "۵. مدت نگهداری اطلاعات",
    body: "اطلاعات حساب شما تا زمانی که حساب فعال است نگهداری می‌شود. در صورت درخواست حذف حساب، اطلاعات شخصی شما ظرف مدت معقول حذف می‌شود، به‌جز مواردی که طبق قانون (مانند سوابق مالی تراکنش‌ها) نگهداری آن‌ها الزامی است.",
  },
  {
    title: "۶. حقوق شما",
    body: "شما می‌توانید در هر زمان از طریق بخش «تنظیمات حساب» به اطلاعات خود دسترسی داشته باشید، آن‌ها را ویرایش کنید، یا درخواست حذف کامل حساب خود را از طریق پشتیبانی ارسال کنید. همچنین می‌توانید اتصال حساب‌های شخص ثالث (وردپرس/اینستاگرام) را در هر زمان از داشبورد قطع کنید.",
  },
  {
    title: "۷. کوکی‌ها",
    body: "AiFekr از کوکی برای مدیریت نشست ورود (session)، ذخیره‌ی ترجیحات (زبان، تم، واحد پول) استفاده می‌کند. این کوکی‌ها برای عملکرد صحیح سایت ضروری‌اند و شامل کوکی‌های تبلیغاتی شخص ثالث نمی‌شوند.",
  },
  {
    title: "۸. تغییرات این سیاست",
    body: "این سیاست حریم خصوصی ممکن است به‌مرور به‌روزرسانی شود. تغییرات مهم از طریق ایمیل یا اعلان داخل سایت به اطلاع شما خواهد رسید.",
  },
  {
    title: "۹. تماس با ما",
    body: "برای هرگونه سوال درباره‌ی حریم خصوصی یا درخواست حذف اطلاعات، از طریق صفحه‌ی «تماس با ما» با ما در ارتباط باشید.",
  },
];

const PRIVACY_EN: LegalSection[] = [
  {
    title: "1. Information We Collect",
    body: "At registration: name, email or mobile number, and password (stored hashed and non-recoverable). While using the services: chat messages, generated content, and credit-usage logs. During payment: transaction information via the Zarinpal payment gateway (your bank card details are never stored on AiFekr's servers). If you optionally connect third-party accounts (WordPress, Instagram): a limited access token (Application Password or Access Token) used only to perform the operations you request.",
  },
  {
    title: "2. How We Use Information",
    body: "Your information is used solely to provide and improve our services, process payments, send essential notifications (account confirmation, payment receipts), and provide technical support. Your chat messages may be sent to AI providers (such as Anthropic, DeepSeek, OpenAI) for processing in order to generate a response; this transmission is only for real-time response generation.",
  },
  {
    title: "3. Information Sharing",
    body: "AiFekr does not sell or rent your personal information to any third party for advertising purposes. Information is shared with third parties only in the following cases: (a) AI providers, to process your requests; (b) the Zarinpal payment gateway, to complete transactions; (c) when required by law by competent authorities.",
  },
  {
    title: "4. Data Security",
    body: "Your password is stored using a one-way hashing algorithm, and even AiFekr's technical team cannot access it. Communication between your browser and AiFekr's servers is encrypted via HTTPS. Tokens for connected third-party accounts (WordPress/Instagram) are stored in an internal database and are never fully displayed in any API response.",
  },
  {
    title: "5. Data Retention",
    body: "Your account information is retained for as long as your account remains active. If you request account deletion, your personal information will be deleted within a reasonable period, except where retention is legally required (such as financial transaction records).",
  },
  {
    title: "6. Your Rights",
    body: "You can access and edit your information at any time through the \"Account Settings\" section, or submit a request for complete account deletion through support. You can also disconnect third-party accounts (WordPress/Instagram) at any time from the dashboard.",
  },
  {
    title: "7. Cookies",
    body: "AiFekr uses cookies to manage login sessions and store preferences (language, theme, currency). These cookies are necessary for the site to function correctly and do not include third-party advertising cookies.",
  },
  {
    title: "8. Changes to This Policy",
    body: "This privacy policy may be updated from time to time. Significant changes will be communicated to you via email or an in-site notification.",
  },
  {
    title: "9. Contact Us",
    body: "For any questions about privacy or to request data deletion, please contact us through the \"Contact Us\" page.",
  },
];

const PRIVACY_DE: LegalSection[] = [
  {
    title: "1. Informationen, die wir sammeln",
    body: "Bei der Registrierung: Name, E-Mail oder Mobilnummer und Passwort (gespeichert als Hash und nicht wiederherstellbar). Bei der Nutzung der Dienste: Chat-Nachrichten, generierte Inhalte und Gutschrift-Protokolle. Bei der Zahlung: Transaktionsinformationen über das Zarinpal-Zahlungsportal (Ihre Bankkartendaten werden niemals auf AiFekr-Servern gespeichert). Bei optionaler Verbindung von Drittanbieter-Konten (WordPress, Instagram): Ein begrenzter Zugriffstoken (Application Password oder Access Token), der nur zur Durchführung Ihrer angeforderten Operationen verwendet wird.",
  },
  {
    title: "2. Wie wir Informationen verwenden",
    body: "Ihre Informationen werden ausschließlich zur Bereitstellung und Verbesserung unserer Dienste, zur Zahlungsabwicklung, zum Versand wesentlicher Benachrichtigungen (Kontobestätigung, Zahlungsbelege) und zur technischen Unterstützung verwendet. Ihre Chat-Nachrichten können zur Verarbeitung an KI-Anbieter (wie Anthropic, DeepSeek, OpenAI) gesendet werden, um eine Antwort zu generieren; diese Übertragung erfolgt nur zur Echtzeit-Antwortgenerierung.",
  },
  {
    title: "3. Informationsweitergabe",
    body: "AiFekr verkauft oder vermietet Ihre persönlichen Informationen nicht an Dritte für Werbezwecke. Informationen werden nur in den folgenden Fällen mit Dritten geteilt: (a) KI-Anbieter, um Ihre Anfragen zu verarbeiten; (b) das Zarinpal-Zahlungsportal, um Transaktionen abzuschließen; (c) bei gesetzlicher Verpflichtung durch zuständige Behörden.",
  },
  {
    title: "4. Datensicherheit",
    body: "Ihr Passwort wird mit einem Einweg-Hash-Algorithmus gespeichert, und selbst das technische Team von AiFekr kann darauf nicht zugreifen. Die Kommunikation zwischen Ihrem Browser und AiFekr-Servern ist über HTTPS verschlüsselt. Tokens für verbundene Drittanbieter-Konten (WordPress/Instagram) werden in einer internen Datenbank gespeichert und niemals vollständig in einer API-Antwort angezeigt.",
  },
  {
    title: "5. Datenaufbewahrung",
    body: "Ihre Kontoinformationen werden aufbewahrt, solange Ihr Konto aktiv ist. Bei einer Löschungsanfrage werden Ihre persönlichen Informationen innerhalb eines angemessenen Zeitraums gelöscht, außer wo eine gesetzliche Aufbewahrungspflicht besteht (z.B. finanzielle Transaktionsaufzeichnungen).",
  },
  {
    title: "6. Ihre Rechte",
    body: "Sie können jederzeit über den Bereich \"Kontoeinstellungen\" auf Ihre Informationen zugreifen und diese bearbeiten, oder eine Anfrage zur vollständigen Kontolöschung über den Support einreichen. Sie können auch Drittanbieter-Konten (WordPress/Instagram) jederzeit vom Dashboard trennen.",
  },
  {
    title: "7. Cookies",
    body: "AiFekr verwendet Cookies zur Verwaltung von Anmeldesessions und Speicherung von Präferenzen (Sprache, Theme, Währung). Diese Cookies sind für das einwandfreie Funktionieren der Seite erforderlich und enthalten keine Cookies von Drittanbietern für Werbezwecke.",
  },
  {
    title: "8. Änderungen dieser Richtlinie",
    body: "Diese Datenschutzrichtlinie kann von Zeit zu Zeit aktualisiert werden. Wesentliche Änderungen werden Ihnen per E-Mail oder einer Benachrichtigung auf der Seite mitgeteilt.",
  },
  {
    title: "9. Kontakt",
    body: "Bei Fragen zum Datenschutz oder zur Anfrage auf Datenlöschung kontaktieren Sie uns bitte über die Seite \"Kontakt\".",
  },
];

const PRIVACY_TR: LegalSection[] = [
  { title: "1. Toplanan bilgiler", body: "Kayıtta ad, e-posta veya telefon ve parola alınır. Kullanım sırasında sohbetler, üretilen içerikler, kredi ve ödeme kayıtları tutulur. İsteğe bağlı hesap bağlantıları için sınırlı erişim belirteçleri saklanır; banka kartı bilgileri sunucumuzda saklanmaz." },
  { title: "2. Bilgilerin kullanımı", body: "Veriler hizmet sunumu, ödemeler, bildirimler ve destek için kullanılır. Yanıt üretmek için istek içeriği ilgili yapay zekâ sağlayıcılarına gönderilebilir." },
  { title: "3. Paylaşım", body: "Kişisel bilgiler reklam için satılmaz veya kiralanmaz. İstekleri işlemek, ödeme yapmak veya yasal gereklilikleri karşılamak için ilgili sağlayıcılarla paylaşılabilir." },
  { title: "4. Güvenlik", body: "Parolalar tek yönlü karma ile saklanır. Tarayıcı ve sunucu arasındaki iletişim HTTPS kullanır. Bağlı hesap belirteçleri API yanıtlarında tam olarak gösterilmez." },
  { title: "5. Saklama", body: "Hesap ve hizmet verileri hizmet sunmak için saklanır. Hesap silme taleplerinde, yasal olarak gerekli ödeme kayıtları hariç ilgili kişisel verilerin kaldırılması için destekle iletişime geçin." },
  { title: "6. Haklarınız", body: "Hesap ayarlarından bilgilerinizi inceleyip değiştirebilir, bağlantıları kaldırabilir veya destekten hesap silme talep edebilirsiniz." },
  { title: "7. Çerezler", body: "Oturum, dil, tema ve para birimi tercihlerinde gerekli çerezler kullanılır. Üçüncü taraf reklam çerezleri kullanılmaz." },
  { title: "8. Değişiklikler", body: "Politika güncellenebilir. Önemli değişiklikler e-posta veya platform bildirimiyle duyurulur." },
  { title: "9. İletişim", body: "Gizlilik soruları veya silme talepleri için iletişim sayfasını kullanın." },
];

const TERMS_FA: LegalSection[] = [
  {
    title: "۱. پذیرش قوانین",
    body: "با ثبت‌نام و استفاده از AiFekr، شما این قوانین و مقررات را می‌پذیرید. اگر با هر بخشی از این قوانین موافق نیستید، لطفاً از خدمات ما استفاده نکنید.",
  },
  {
    title: "۲. توضیح خدمات",
    body: "AiFekr یک پلتفرم هوش مصنوعی است که خدماتی از جمله چت هوشمند، تولید تصویر/ویدیو/موزیک، ابزارهای سئو و خودکارسازی شبکه‌های اجتماعی (اینستاگرام) را بر پایه‌ی اعتبار (credit) ارائه می‌دهد. برخی ابزارها (مانند اتصال وردپرس یا اینستاگرام) نیازمند اتصال حساب‌های شخص ثالث شما هستند که کاملاً اختیاری و با اجازه‌ی صریح شما انجام می‌شود.",
  },
  {
    title: "۳. حساب کاربری",
    body: "شما مسئول حفظ محرمانگی اطلاعات ورود (ایمیل/موبایل و رمز عبور) خود هستید. هرگونه فعالیت انجام‌شده از طریق حساب شما، مسئولیتش بر عهده‌ی شماست. در صورت مشاهده‌ی هرگونه استفاده‌ی غیرمجاز، موظفید سریعاً به پشتیبانی اطلاع دهید.",
  },
  {
    title: "۴. اعتبار، پلن‌ها و پرداخت",
    body: "خرید پلن‌ها و اعتبار از طریق درگاه پرداخت زرین‌پال انجام می‌شود. اعتبار خریداری‌شده تا زمان مصرف کامل، منقضی نمی‌شود. قیمت‌ها ممکن است بدون اطلاع قبلی تغییر کنند، اما تغییر قیمت بر پلن‌های از قبل خریداری‌شده تاثیری ندارد.",
  },
  {
    title: "۵. سیاست بازگشت وجه",
    body: "به دلیل ماهیت مصرف فوری اعتبار هوش مصنوعی، وجه پرداختی برای اعتبار مصرف‌شده قابل بازگشت نیست. در صورت بروز خطای فنی که منجر به کسر اعتبار بدون دریافت خروجی شود، با ارائه‌ی مدرک (مانند شناسه‌ی تراکنش) از طریق پشتیبانی، اعتبار به‌صورت جبرانی به حساب شما بازگردانده می‌شود.",
  },
  {
    title: "۶. استفاده‌ی مجاز",
    body: "استفاده از AiFekr برای تولید محتوای غیرقانونی، توهین‌آمیز، ناقض حقوق مالکیت فکری، یا هرگونه فعالیت مغایر با قوانین جمهوری اسلامی ایران ممنوع است. AiFekr می‌تواند در صورت مشاهده‌ی چنین موارد، بدون اطلاع قبلی حساب کاربری را مسدود کند.",
  },
  {
    title: "۷. محتوای تولیدشده توسط هوش مصنوعی",
    body: "خروجی‌های تولیدشده توسط مدل‌های هوش مصنوعی ممکن است حاوی خطا یا نادرستی باشند. مسئولیت بررسی نهایی و استفاده از هر خروجی (متن، تصویر، پست شبکه‌های اجتماعی، تغییرات سئو) بر عهده‌ی کاربر است، به‌ویژه در ویژگی‌های خودکارسازی (مانند انتشار خودکار در اینستاگرام یا ویرایش خودکار وبسایت) که مستقیماً روی حساب‌ها/سایت‌های واقعی شما اعمال می‌شوند.",
  },
  {
    title: "۸. محدودیت مسئولیت",
    body: "AiFekr هیچ‌گونه ضمانتی در مورد در دسترس‌بودن دائمی سرویس یا دقت صددرصدی خروجی‌های هوش مصنوعی ارائه نمی‌دهد. در حداکثر میزان مجاز طبق قانون، مسئولیت AiFekr در قبال هرگونه خسارت غیرمستقیم محدود است.",
  },
  {
    title: "۹. تغییرات قوانین",
    body: "این قوانین ممکن است در آینده به‌روزرسانی شوند. تاریخ آخرین به‌روزرسانی در پایین همین صفحه درج شده است. ادامه‌ی استفاده از سرویس پس از تغییر قوانین، به‌معنی پذیرش قوانین جدید است.",
  },
  {
    title: "۱۰. تماس با ما",
    body: "برای هرگونه سوال درباره‌ی این قوانین، از طریق صفحه‌ی «تماس با ما» با پشتیبانی AiFekr در ارتباط باشید.",
  },
];

const TERMS_EN: LegalSection[] = [
  {
    title: "1. Acceptance of Terms",
    body: "By registering for and using AiFekr, you accept these terms and conditions. If you do not agree with any part of these terms, please do not use our services.",
  },
  {
    title: "2. Description of Services",
    body: "AiFekr is an AI platform that provides services including smart chat, image/video/music generation, SEO tools, and social-media automation (Instagram) on a credit-based system. Some tools (such as WordPress or Instagram integration) require connecting your third-party accounts, which is entirely optional and performed only with your explicit permission.",
  },
  {
    title: "3. User Account",
    body: "You are responsible for keeping your login credentials (email/mobile number and password) confidential. You are responsible for any activity carried out through your account. If you notice any unauthorized use, you must notify support immediately.",
  },
  {
    title: "4. Credits, Plans, and Payment",
    body: "Plans and credits are purchased through the Zarinpal payment gateway. Purchased credits do not expire until fully consumed. Prices may change without prior notice, but a price change does not affect plans already purchased.",
  },
  {
    title: "5. Refund Policy",
    body: "Due to the immediate-consumption nature of AI credits, payments for consumed credits are non-refundable. If a technical error causes credits to be deducted without producing an output, credits will be refunded to your account as compensation upon providing evidence (such as a transaction ID) through support.",
  },
  {
    title: "6. Acceptable Use",
    body: "Using AiFekr to generate illegal or offensive content, content that infringes intellectual property rights, or any activity contrary to the laws of the Islamic Republic of Iran is prohibited. AiFekr may suspend an account without prior notice if such conduct is observed.",
  },
  {
    title: "7. AI-Generated Content",
    body: "Output generated by AI models may contain errors or inaccuracies. The user is responsible for the final review and use of any output (text, images, social media posts, SEO changes), particularly in automation features (such as auto-publishing to Instagram or automatic website edits) that apply directly to your real accounts/websites.",
  },
  {
    title: "8. Limitation of Liability",
    body: "AiFekr makes no guarantee regarding permanent service availability or 100% accuracy of AI-generated output. To the maximum extent permitted by law, AiFekr's liability for any indirect damages is limited.",
  },
  {
    title: "9. Changes to Terms",
    body: "These terms may be updated in the future. The date of the last update is shown at the bottom of this page. Continued use of the service after a change to the terms constitutes acceptance of the new terms.",
  },
  {
    title: "10. Contact Us",
    body: "For any questions about these terms, please contact AiFekr support through the \"Contact Us\" page.",
  },
];

const TERMS_DE: LegalSection[] = [
  {
    title: "1. Annahme der Bedingungen",
    body: "Durch die Registrierung und Nutzung von AiFekr akzeptieren Sie diese Terms of Service. Wenn Sie mit einem Teil dieser Bedingungen nicht einverstanden sind, nutzen Sie bitte nicht unsere Dienste.",
  },
  {
    title: "2. Beschreibung der Dienste",
    body: "AiFekr ist eine KI-Plattform, die Dienste wie intelligenten Chat, Bild-/Video-/Musikerstellung, SEO-Tools und Social-Media-Automatisierung (Instagram) auf Basis eines Gutschriftsystems anbietet. Einige Tools (wie WordPress- oder Instagram-Integration) erfordern die Verbindung Ihrer Drittanbieter-Konten, was vollständig optional und nur mit Ihrer ausdrücklichen Genehmigung erfolgt.",
  },
  {
    title: "3. Benutzerkonto",
    body: "Sie sind verantwortlich für die Vertraulichkeit Ihrer Zugangsdaten (E-Mail/Mobilnummer und Passwort). Sie sind verantwortlich für jede Aktivität, die über Ihr Konto ausgeführt wird. Bei unbefugter Nutzung müssen Sie sofort den Support informieren.",
  },
  {
    title: "4. Gutschriften, Pläne und Zahlung",
    body: "Pläne und Gutschriften werden über das Zarinpal-Zahlungsportal gekauft. Gekaufte Gutschrifte laufen nicht ab, bis sie vollständig verbraucht sind. Preise können sich ohne Vorankündigung ändern, aber Preisänderungen beeinflussen bereits gekaufte Pläne nicht.",
  },
  {
    title: "5. Rückerstattungsrichtlinie",
    body: "Aufgrund der sofortigen Verbrauchsart von KI-Gutschriften sind Zahlungen für verbrauchte Gutschrifte nicht erstattungsfähig. Wenn ein technischer Fehler zu Gutschriftabzügen ohne Ergebnis führt, werden die Gutschrifte als Entschädigung auf Ihr Konto zurückerstattet, nachdem Sie einen Beleg (z.B. Transaktions-ID) über den Support vorgelegt haben.",
  },
  {
    title: "6. Erlaubte Nutzung",
    body: "Die Nutzung von AiFekr zur Erstellung illegaler oder beleidigender Inhalte, Inhalte die geistige Eigentumsrechte verletzen, oder jede Tätigkeit gegen die Gesetze der Islamischen Republik Iran ist verboten. AiFekr kann Konten ohne Vorankündigung sperren, wenn solche Verstöße festgestellt werden.",
  },
  {
    title: "7. KI-generierte Inhalte",
    body: "Von KI-Modellen generierte Ausgaben können Fehler oder Ungenauigkeiten enthalten. Der Benutzer ist verantwortlich für die endgültige Überprüfung und Nutzung jeder Ausgabe (Text, Bilder, Social-Media-Beiträge, SEO-Änderungen), insbesondere bei Automatisierungsfunktionen (wie automatische Veröffentlichung auf Instagram oder automatische Website-Edits), die direkt auf Ihren echten Konten/Websites angewendet werden.",
  },
  {
    title: "8. Haftungsbeschränkung",
    body: "AiFekr übernimmt keine Garantie für dauerhafte Serviceverfügbarkeit oder 100%ige Genauigkeit von KI-generierten Ausgaben. Im maximal gesetzlich zulässigen Umfang ist die Haftung von AiFekr für mittelbare Schäden beschränkt.",
  },
  {
    title: "9. Änderungen der Bedingungen",
    body: "Diese Bedingungen können in Zukunft aktualisiert werden. Das Datum der letzten Aktualisierung wird unten auf dieser Seite angezeigt. Durch die weitere Nutzung des Dienstes nach einer Änderung der Bedingungen akzeptieren Sie die neuen Bedingungen.",
  },
  {
    title: "10. Kontakt",
    body: "Bei Fragen zu diesen Bedingungen kontaktieren Sie bitte den AiFekr-Support über die Seite \"Kontakt\".",
  },
];

const TERMS_TR: LegalSection[] = [
  { title: "1. Koşulların kabulü", body: "AIFekr'e kayıt ve hizmet kullanımı bu koşulların kabulü anlamına gelir. Kabul etmiyorsanız hizmeti kullanmayın." },
  { title: "2. Hizmetler", body: "Platform kredi temelli sohbet, görsel, video, müzik, SEO ve sosyal medya araçları sunar. WordPress ve Instagram gibi hesap bağlantıları isteğe bağlıdır ve izninizi gerektirir." },
  { title: "3. Hesap", body: "Giriş bilgilerinizin gizliliğinden ve hesabınızdaki faaliyetlerden siz sorumlusunuz. Yetkisiz kullanım fark ederseniz destekle iletişime geçin." },
  { title: "4. Krediler ve ödeme", body: "Plan ve kredi alımları mevcut ödeme seçenekleriyle yapılır. Satın alınan krediler tüketilene kadar geçerlidir. Fiyat değişiklikleri daha önce tamamlanmış alımları etkilemez." },
  { title: "5. İade", body: "Tüketilen krediler için iade yapılmaz. Teknik hata sonucu çıktı almadan kredi düşülürse işlem bilgisiyle desteğe başvurun; inceleme sonrası telafi kredisi verilebilir." },
  { title: "6. İzin verilen kullanım", body: "Yasa dışı, saldırgan veya fikri mülkiyet haklarını ihlal eden içerikler yasaktır. İhlallerde hesap erişimi durdurulabilir." },
  { title: "7. Yapay zekâ çıktıları", body: "Çıktılar hatalı olabilir. Özellikle yayın ve otomasyon işlemlerinden önce içerikleri incelemek ve kullanımını değerlendirmek sizin sorumluluğunuzdur." },
  { title: "8. Sorumluluk sınırı", body: "Kesintisiz erişim veya çıktıların yüzde yüz doğruluğu garanti edilmez. Yasal sınırlar içinde dolaylı zararlara ilişkin sorumluluk sınırlıdır." },
  { title: "9. Değişiklikler", body: "Koşullar güncellenebilir. Güncelleme sonrasında hizmeti kullanmayı sürdürmek yeni koşulları kabul etmek anlamına gelir." },
  { title: "10. İletişim", body: "Sorularınız için iletişim sayfasından destek ekibine ulaşın." },
];

const SECURITY: { title: Copy; body: Copy }[] = [
  { title: ["حساب و دسترسی", "Account & access", "Konto & Zugriff", "Hesap ve erişim"], body: ["فضاهای کاری نیازمند ورودند. دسترسی ابزارها براساس حساب، کسب‌وکار، نقش و ماژول فعال کنترل می‌شود. رمز عبور به‌صورت هش ذخیره می‌شود.", "Workspaces require sign-in. Access is controlled by account, business, role and enabled modules. Passwords are stored as hashes.", "Arbeitsbereiche erfordern Anmeldung. Zugriff wird nach Konto, Unternehmen, Rolle und Modulen kontrolliert. Passwörter werden als Hash gespeichert.", "Çalışma alanları giriş gerektirir. Erişim hesap, işletme, rol ve modüllere göre kontrol edilir. Parolalar karma olarak saklanır."] },
  { title: ["ارائه‌دهندگان AI", "AI providers", "KI-Anbieter", "Yapay zekâ sağlayıcıları"], body: ["برای پاسخ یا تولید، اطلاعات درخواست ممکن است به ارائه‌دهندهٔ مدل ارسال شود. دادهٔ حساس غیرضروری را وارد نکنید و سیاست حریم خصوصی را بررسی کنید.", "Request content may be sent to model providers to generate responses or media. Avoid unnecessary sensitive information and review our privacy policy.", "Anfrageinhalte können zur Generierung an Modellanbieter gesendet werden. Unnötige sensible Daten vermeiden und Datenschutzrichtlinie prüfen.", "Yanıt veya medya üretmek için istek içeriği model sağlayıcılara gönderilebilir. Gereksiz hassas bilgilerden kaçının ve gizlilik politikasını inceleyin."] },
  { title: ["اتصال‌های اختیاری", "Optional connections", "Optionale Verbindungen", "İsteğe bağlı bağlantılar"], body: ["اتصال اینستاگرام، وردپرس و منابع لید به مجوز شما و تنظیمات حساب وابسته است. قواعد و محدودیت‌های سرویس خارجی همچنان اعمال می‌شوند.", "Instagram, WordPress and lead-source connections depend on your permission and account setup. External service rules and limits still apply.", "Instagram-, WordPress- und Lead-Verbindungen hängen von Berechtigungen und Einrichtung ab. Regeln und Limits der Anbieter gelten weiterhin.", "Instagram, WordPress ve kaynak bağlantıları izinlerinize ve hesap kurulumuna bağlıdır. Dış servis kuralları ve sınırları geçerlidir."] },
  { title: ["مسئولیت بررسی خروجی", "Review before acting", "Vor Aktionen prüfen", "İşlemden önce inceleyin"], body: ["این صفحه ادعای گواهی امنیتی، تضمین uptime یا انطباق حقوقی نمی‌کند. خروجی AI ممکن است خطا داشته باشد؛ تصمیم مالی، انتشار و پیام‌رسانی را بررسی کنید.", "This page makes no security certification, uptime or legal compliance guarantee. AI can make mistakes; review financial decisions, publishing and messaging.", "Diese Seite garantiert keine Sicherheitszertifizierung, Verfügbarkeit oder Rechtskonformität. KI kann Fehler machen; Finanzen, Veröffentlichung und Nachrichten prüfen.", "Bu sayfa güvenlik sertifikası, çalışma süresi veya yasal uyum garantisi vermez. Yapay zekâ hata yapabilir; mali kararları, yayınları ve mesajları inceleyin."] },
];

const pick = <T,>(lang: Lang, fa: T, en: T, de: T, tr: T) => (lang === "fa" ? fa : lang === "de" ? de : lang === "tr" ? tr : en);
const UPDATED = (lang: Lang) => pick(lang, "آخرین به‌روزرسانی: تیر ۱۴۰۵", "Last updated: July 2026", "Zuletzt aktualisiert: Juli 2026", "Son güncelleme: Temmuz 2026");
export const LEGAL_PAGES = ["privacy", "terms", "security"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

/** A legal page in the visitor's language. */
export function legalPage(lang: Lang, page: LegalPage): { title: string; updated: string | null; sections: LegalSection[] } {
  if (page === "privacy") return { title: pick(lang, "حریم خصوصی", "Privacy Policy", "Datenschutzrichtlinie", "Gizlilik politikası"), updated: UPDATED(lang), sections: pick(lang, PRIVACY_FA, PRIVACY_EN, PRIVACY_DE, PRIVACY_TR) };
  if (page === "terms") return { title: pick(lang, "قوانین و مقررات استفاده از AiFekr", "AiFekr Terms of Service", "AiFekr Nutzungsbedingungen", "AIFekr kullanım koşulları"), updated: UPDATED(lang), sections: pick(lang, TERMS_FA, TERMS_EN, TERMS_DE, TERMS_TR) };
  return { title: text(lang, copy.security), updated: null, sections: SECURITY.map((s: { title: Copy; body: Copy }) => ({ title: text(lang, s.title), body: text(lang, s.body) })) };
}

type Four = { fa: string; en: string; de: string; tr: string };
const four = (c: Copy): Four => ({ fa: c[0], en: c[1], de: c[2], tr: c[3] });
/** Title and description for each legal page's metadata (classic pages and the new design). */
export const LEGAL_META: Record<LegalPage, [title: Four, description: Four]> = {
  privacy: [{"fa":"حریم خصوصی — نحوه نگهداری داده‌های شما","en":"Privacy Policy — How We Handle Your Data","de":"Datenschutz — So gehen wir mit Ihren Daten um","tr":"Gizlilik Politikası — Verilerinizi Nasıl Kullanırız"}, {"fa":"سیاست حریم خصوصی AiFekr: چه داده‌هایی جمع‌آوری می‌کنیم، چگونه از آن‌ها استفاده می‌کنیم و چه حقوقی دارید.","en":"AiFekr's privacy policy: what data we collect, how we use it and what rights you have.","de":"Datenschutzerklärung von AiFekr: welche Daten wir erheben, wie wir sie verwenden und welche Rechte Sie haben.","tr":"AiFekr gizlilik politikası: hangi verileri topladığımız, nasıl kullandığımız ve haklarınız."}],
  terms: [{"fa":"شرایط استفاده — قوانین، پرداخت و اعتبار","en":"Terms of Service — Rules, Payments & Credits","de":"Nutzungsbedingungen — Regeln, Zahlung & Credits","tr":"Kullanım Koşulları — Kurallar, Ödeme ve Krediler"}, {"fa":"شرایط و قوانین استفاده از پلتفرم هوش مصنوعی AiFekr، پرداخت‌ها و اعتبارها.","en":"Terms and conditions for using the AiFekr AI platform, payments and credits.","de":"Nutzungsbedingungen der KI-Plattform AiFekr, Zahlungen und Credits.","tr":"AiFekr yapay zekâ platformunun kullanım koşulları, ödemeler ve krediler."}],
  security: [four(copy.security), four(copy.noPromise)],
};
