import Link from "next/link";
import Image from "next/image";
import SocialFooterLinks from "@/components/layout/SocialFooterLinks";
import { getServerLang } from "@/lib/i18n/server";

export const dynamic = "force-static";

const SECTIONS_FA = [
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

const SECTIONS_EN = [
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

export default async function PrivacyPage() {
  const lang = await getServerLang();
  const isFa = lang !== "en";
  const SECTIONS = isFa ? SECTIONS_FA : SECTIONS_EN;

  return (
    <div className="min-h-screen" dir={isFa ? "rtl" : "ltr"} style={{ background: "#0a0a0f", color: "#f5f5f5" }}>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="AiFekr" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg text-white">AiFekr</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/terms" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "قوانین و مقررات" : "Terms of Service"}</Link>
          <Link href="/privacy" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "#ea580c" }}>{isFa ? "حریم خصوصی" : "Privacy Policy"}</Link>
          <Link href="/login" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "ورود" : "Log in"}</Link>
        </div>
      </nav>

      <section className="pt-40 pb-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{isFa ? "حریم خصوصی" : "Privacy Policy"}</h1>
        <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>{isFa ? "آخرین به‌روزرسانی: تیر ۱۴۰۵" : "Last updated: July 2026"}</p>

        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold mb-2" style={{ color: "#ea580c" }}>{s.title}</h2>
              <p className="text-sm leading-7" style={{ color: "rgba(255,255,255,0.75)" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-8 px-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <SocialFooterLinks />
      </footer>
    </div>
  );
}
