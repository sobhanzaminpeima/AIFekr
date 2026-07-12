import Link from "next/link";
import Image from "next/image";
import { getServerLang } from "@/lib/i18n/server";
import SocialFooterLinks from "@/components/layout/SocialFooterLinks";
import AiTeamPipeline from "@/components/landing/AiTeamPipeline";

export const dynamic = "force-dynamic";

const STR = {
  fa: {
    back: "بازگشت به صفحه اصلی",
    heroEyebrow: "سیستم‌عامل هوشمند کسب‌وکار",
    heroTitle: "یک تیم کامل از عامل‌های هوش مصنوعی، که برای شما کار می‌کنند",
    heroDesc: "AiFekr دیگر فقط یک ابزار تک‌کاره نیست. یک زنجیرهٔ ۸ عامل تخصصی برای تولید محتوا، و یک مدیرعامل هوش مصنوعی که وضعیت کل کسب‌وکار شما را می‌بیند، تحلیل می‌کند و تصمیم می‌گیرد — با حافظهٔ مشترک که هر بار بهتر می‌شود.",
    heroCta: "شروع رایگان",
    pipelineTitle: "خط تولید محتوا — ۸ عامل، یک زنجیره",
    pipelineDesc: "خروجی هر عامل، ورودی عامل بعدی است. نتیجه یک مقالهٔ کامل، بهینه‌شده برای سئو، و آمادهٔ انتشار مستقیم روی سایت شماست.",
    agents: [
      { title: "ایده‌یاب", desc: "۶ تا ۸ ایدهٔ مقالهٔ متفاوت برای صنعت شما پیدا می‌کند." },
      { title: "استراتژیست محتوا", desc: "بهترین ایده را از نظر ارزش برای مخاطب و پتانسیل سئو انتخاب می‌کند." },
      { title: "پژوهشگر", desc: "با جستجوی زندهٔ وب، فکت‌های واقعی و به‌روز پیدا می‌کند — نه حدس." },
      { title: "نویسنده", desc: "پیش‌نویس کامل مقاله را با لحن برند شما می‌نویسد." },
      { title: "ویراستار", desc: "به متن امتیاز می‌دهد؛ اگر پایین باشد، برای بازنویسی به نویسنده برمی‌گردد." },
      { title: "متخصص سئو", desc: "عنوان، توضیحات متا، اسلاگ و کلمات کلیدی را بهینه می‌کند." },
      { title: "ناشر", desc: "مقالهٔ تایید‌شده را مستقیماً روی سایت وردپرس شما منتشر می‌کند." },
      { title: "منتقد", desc: "پست منتشرشده را نقد می‌کند و درس‌های عملی برای اجراهای بعدی ثبت می‌کند." },
    ],
    loopTitle: "حلقهٔ بازخورد واقعی",
    loopDesc: "اگر ویراستار امتیاز پایینی بدهد، مقاله خودکار برای بازنویسی به نویسنده برمی‌گردد — تا سقف چند تلاش — پیش از رسیدن به مرحلهٔ سئو و انتشار.",
    memoryTitle: "حافظهٔ مشترک — سیستم هر بار بهتر می‌شود",
    memoryDesc: "منتقد بعد از هر اجرا، درس‌های کوتاه و عملی برای هرکدام از عامل‌ها می‌نویسد (مثلاً «جمله‌ها را کوتاه‌تر بنویس»). این درس‌ها در اجراهای بعدی خودکار به هرکدام یادآوری می‌شوند. شما هم می‌توانید مستقیماً نکته اضافه کنید.",
    doctorEyebrow: "یکی دیگر از اعضای تیم",
    doctorTitle: "دکتر کسب‌وکار — تشخیص کامل، نه یک پاسخ سطحی",
    doctorDesc: "یک مشاور با ۲۰ سال تجربهٔ شبیه‌سازی‌شده که کسب‌وکار شما را مثل یک پروندهٔ پزشکی بررسی می‌کند و یک گزارش تشخیص کامل تحویل می‌دهد — نتیجه‌اش مستقیماً وارد حافظهٔ مشترک هماهنگ‌کنندهٔ کسب‌وکار هم می‌شود.",
    doctorFeatures: [
      { title: "تحلیل SWOT کامل", desc: "نقاط قوت، ضعف، فرصت‌ها و تهدیدهای واقعی کسب‌وکار شما را مشخص می‌کند." },
      { title: "شناسایی چالش‌های کلیدی", desc: "مهم‌ترین موانع رشد را که ممکن است خودتان متوجه نشده باشید، پیدا می‌کند." },
      { title: "برنامهٔ عملیاتی ۳۰/۶۰/۹۰ روزه", desc: "یک نقشهٔ راه مشخص و زمان‌بندی‌شده برای سه ماه آینده می‌دهد، نه توصیهٔ کلی." },
      { title: "شاخص‌های کلیدی عملکرد (KPI)", desc: "معیارهایی مشخص می‌کند که بتوانید پیشرفت واقعی را اندازه بگیرید." },
    ],
    ceoTitle: "مدیرعامل هوش مصنوعی — نگاه کلی به کسب‌وکار",
    ceoDesc: "یک عامل جداگانه که وضعیت واقعی همهٔ ابزارهای شما را می‌بیند و اولویت‌بندی می‌کند — نه یک نمایش، بلکه یک تحلیل واقعی بر پایهٔ داده‌های واقعی.",
    ceoFeatures: [
      { title: "دیتای واقعی، نه ساختگی", desc: "تحلیل‌های دکتر کسب‌وکار، مقالات منتشرشده، پست‌های شبکهٔ اجتماعی، مخاطبان CRM نیازمند پیگیری، درآمد و فعالیت ۳۰ روز اخیر." },
      { title: "پژوهش زندهٔ بازار و رقبا", desc: "با جستجوی وب، آخرین روندهای بازار و رقبای صنعت شما را پیدا و خلاصه می‌کند." },
      { title: "پیش‌نویس پیگیری فروش", desc: "برای مخاطبانی که نیاز به پیگیری دارند، پیام آمادهٔ ارسال می‌نویسد — شما تایید و ارسال می‌کنید." },
      { title: "اجرای خودکار روزانه", desc: "می‌توانید فعالش کنید تا هر روز بدون کلیک شما اجرا شود و خلاصه را ایمیل کند." },
    ],
    finalCtaTitle: "همین حالا این سیستم را امتحان کنید",
    finalCtaDesc: "بدون نیاز به کارت اعتباری — شروع رایگان",
    finalCtaButton: "شروع رایگان",
  },
  en: {
    back: "Back to home",
    heroEyebrow: "Autonomous Business Operating System",
    heroTitle: "A full team of AI agents, working for you",
    heroDesc: "AiFekr isn't a single-purpose tool anymore. An 8-agent chain writes and publishes content, and an AI CEO watches your whole business, analyzes it, and decides what matters — with shared memory that improves over time.",
    heroCta: "Start Free",
    pipelineTitle: "Content Pipeline — 8 Agents, One Chain",
    pipelineDesc: "Each agent's output feeds the next. The result: a complete, SEO-optimized article, ready to publish directly to your site.",
    agents: [
      { title: "Idea Finder", desc: "Finds 6-8 distinct article ideas for your industry." },
      { title: "Content Strategist", desc: "Picks the best idea by audience value and SEO potential." },
      { title: "Researcher", desc: "Uses live web search for real, current facts — not guesses." },
      { title: "Writer", desc: "Writes a full draft in your brand's voice." },
      { title: "Editor", desc: "Scores the draft; if it's low, sends it back to the writer for revision." },
      { title: "SEO Expert", desc: "Optimizes title, meta description, slug, and keywords." },
      { title: "Publisher", desc: "Publishes the approved article directly to your WordPress site." },
      { title: "Critic", desc: "Reviews the published post and logs practical lessons for next time." },
    ],
    loopTitle: "A Real Feedback Loop",
    loopDesc: "If the editor scores the draft low, it automatically goes back to the writer for revision — up to a few rounds — before moving on to SEO and publishing.",
    memoryTitle: "Shared Memory — The System Gets Better Every Time",
    memoryDesc: "After each run, the critic writes short, practical lessons for each agent (e.g. \"write shorter sentences\"). These are automatically recalled in future runs. You can add notes yourself too.",
    doctorEyebrow: "Another member of the team",
    doctorTitle: "Business Doctor — A Full Diagnosis, Not a Shallow Answer",
    doctorDesc: "A simulated 20-year veteran consultant who examines your business like a medical chart and delivers a complete diagnostic report — its findings feed directly into the CEO orchestrator's shared memory too.",
    doctorFeatures: [
      { title: "Full SWOT Analysis", desc: "Identifies your business's real strengths, weaknesses, opportunities, and threats." },
      { title: "Key Challenge Detection", desc: "Finds the biggest growth blockers — ones you might not have noticed yourself." },
      { title: "30/60/90-Day Action Plan", desc: "A concrete, timed roadmap for the next three months — not generic advice." },
      { title: "Key Performance Indicators", desc: "Defines the metrics you need to actually measure progress." },
    ],
    ceoTitle: "AI CEO — A Real View of Your Business",
    ceoDesc: "A dedicated agent that sees the real status of every tool and prioritizes what matters — not a demo, an analysis grounded in real data.",
    ceoFeatures: [
      { title: "Real Data, Not Fabricated", desc: "Business Doctor analyses, published articles, social posts, CRM contacts needing follow-up, revenue and activity over the last 30 days." },
      { title: "Live Market & Competitor Research", desc: "Searches the web for the latest trends and competitors in your industry." },
      { title: "Sales Follow-Up Drafts", desc: "Drafts ready-to-send messages for leads needing follow-up — you review and send." },
      { title: "Autonomous Daily Run", desc: "Opt in to run automatically every day with no click needed, and get an email digest." },
    ],
    finalCtaTitle: "Try this system right now",
    finalCtaDesc: "No credit card needed — start free",
    finalCtaButton: "Start Free",
  },
};

export default async function AiTeamPage() {
  const lang = await getServerLang();
  const s = STR[lang];
  const dir = lang === "fa" ? "rtl" : "ltr";

  return (
    <div className="min-h-screen" dir={dir} style={{ background: "#0a0a0f", color: "#f5f5f5" }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="AiFekr" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-white">AiFekr</span>
        </Link>
        <Link href="/" className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{s.back}</Link>
      </header>

      <AiTeamPipeline s={s} />

      <footer className="py-8 px-6 text-center text-sm" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
        <SocialFooterLinks />
      </footer>
    </div>
  );
}
