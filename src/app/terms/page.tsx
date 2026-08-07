import Link from "next/link";
import Image from "next/image";
import SocialFooterLinks from "@/components/layout/SocialFooterLinks";
import { getServerLang } from "@/lib/i18n/server";

export const dynamic = "force-static";

const SECTIONS_FA = [
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

const SECTIONS_EN = [
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

export default async function TermsPage() {
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
          <Link href="/terms" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "#ea580c" }}>{isFa ? "قوانین و مقررات" : "Terms of Service"}</Link>
          <Link href="/privacy" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "حریم خصوصی" : "Privacy Policy"}</Link>
          <Link href="/login" className="text-sm px-3 py-2 rounded-xl transition-all" style={{ color: "rgba(255,255,255,0.7)" }}>{isFa ? "ورود" : "Log in"}</Link>
        </div>
      </nav>

      <section className="pt-40 pb-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{isFa ? "قوانین و مقررات استفاده از AiFekr" : "AiFekr Terms of Service"}</h1>
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
