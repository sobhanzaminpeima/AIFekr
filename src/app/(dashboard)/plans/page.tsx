"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import {
  Check, X, Zap, Loader2, CheckCircle, ChevronDown, Building2,
  MessageSquare, Image, Music, Video, Sparkles, Crown,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

// ── Types ────────────────────────────────────────────────────────────────────
type Market = "IR" | "INTL";
type Period = "monthly" | "annual";

type ApiPackage = {
  planCode: string; name: string; nameEn: string;
  price: number; priceUsd: number | null; market: string;
  duration: number; credits: number; isFeatured: boolean;
  color: string; features: string; featuresEn?: string;
};

// ── Static data ───────────────────────────────────────────────────────────────
const ANNUAL_DISCOUNT = 2 / 12;

const FEATURE_ROWS = [
  { sectionFa: "چت", sectionEn: "Chat", icon: MessageSquare, rows: [
    { labelFa: "پیام در روز / ۳ ساعت", labelEn: "Messages per day / 3h", ir: ["۲۰/روز", "۵۰/۳ساعت", "۱۰۰/۳ساعت", "۱۵۰/۳ساعت", "۷۵۰/۳ساعت"], en: ["20/day", "50/3h", "100/3h", "150/3h", "750/3h"] },
    { labelFa: "مدل‌های پایه", labelEn: "Basic models", ir: [true, true, true, true, true], en: [true, true, true, true, true] },
    { labelFa: "مدل‌های پیشرفته", labelEn: "Advanced models", subtitle: "Claude Sonnet, GPT-5, Gemini Pro", ir: [false, false, true, true, true], en: [false, false, true, true, true] },
    { labelFa: "مدل‌های حرفه‌ای", labelEn: "Pro models", subtitle: "Claude Opus, GPT-5 Sol, o3", ir: [false, false, false, true, true], en: [false, false, false, true, true] },
    { labelFa: "جستجو در اینترنت", labelEn: "Web search", ir: [true, true, true, true, true], en: [true, true, true, true, true] },
    { labelFa: "آپلود فایل", labelEn: "File upload", ir: [false, true, true, true, true], en: [false, true, true, true, true] },
    { labelFa: "کاوش عمیق (Deep Research)", labelEn: "Deep Research", ir: [false, false, true, true, true], en: [false, false, true, true, true] },
  ]},
  { sectionFa: "تصویر", sectionEn: "Image", icon: Image, rows: [
    { labelFa: "تعداد تصویر", labelEn: "Images", ir: ["۳/روز", "۱۵/روز", "نامحدود", "نامحدود", "نامحدود"], en: ["3/day", "15/day", "Unlimited", "Unlimited", "Unlimited"] },
    { labelFa: "مدل‌های پیشرفته", labelEn: "Advanced models", subtitle: "Flux Pro, SDXL, Gemini Image", ir: [false, false, true, true, true], en: [false, false, true, true, true] },
    { labelFa: "Midjourney", labelEn: "Midjourney", ir: [false, false, false, true, true], en: [false, false, false, true, true] },
  ]},
  { sectionFa: "موزیک", sectionEn: "Music", icon: Music, rows: [
    { labelFa: "ساخت موزیک (Suno)", labelEn: "Music generation (Suno)", ir: [false, false, true, true, true], en: [false, false, true, true, true] },
  ]},
  { sectionFa: "ویدیو", sectionEn: "Video", icon: Video, rows: [
    { labelFa: "تعداد ویدیو در هفته", labelEn: "Videos per week", ir: ["—", "—", "—", "۲۰", "۱۰۰"], en: ["—", "—", "—", "20", "100"] },
    { labelFa: "مدل ویدیو (Veo, Kling)", labelEn: "Video models (Veo, Kling)", ir: [false, false, false, true, true], en: [false, false, false, true, true] },
  ]},
  { sectionFa: "امکانات دیگر", sectionEn: "Other Features", icon: Sparkles, rows: [
    { labelFa: "ساخت وبسایت هوشمند", labelEn: "AI website builder", ir: [false, false, false, true, true], en: [false, false, false, true, true] },
    { labelFa: "بدون تبلیغات", labelEn: "Ad-free", ir: [false, true, true, true, true], en: [false, true, true, true, true] },
    { labelFa: "سرعت پاسخ بالاتر", labelEn: "Faster responses", ir: [false, false, false, true, true], en: [false, false, false, true, true] },
    { labelFa: "دسترسی زودهنگام", labelEn: "Early access", ir: [false, false, false, false, true], en: [false, false, false, false, true] },
    { labelFa: "پشتیبانی VIP", labelEn: "VIP support", ir: [false, false, false, false, true], en: [false, false, false, false, true] },
  ]},
];

const IR_PLAN_CODES  = ["FREE", "ECHO", "PLUS", "PRO", "ALPHA"];
const USD_PLAN_CODES = ["FREE", "STARTER_USD", "PLUS_USD", "PRO_USD", "ULTRA_USD"];

const FREE_IR: ApiPackage  = { planCode: "FREE", name: "رایگان", nameEn: "Free", price: 0, priceUsd: 0, market: "IR",   duration: 30, credits: 100, isFeatured: false, color: "#71717a", features: "۲۰ چت در روز\n۳ تصویر در روز\nمدل‌های پایه" };
const FREE_USD: ApiPackage = { planCode: "FREE", name: "Free",   nameEn: "Free", price: 0, priceUsd: 0, market: "INTL", duration: 30, credits: 100, isFeatured: false, color: "#71717a", features: "20 chats per day\n3 images per day\nBasic models" };

const BIZ_PLANS_IR = [
  { name: "تیم کوچک", desc: "تا ۵ کاربر", price: 4990000, color: "#6366f1", features: ["همه امکانات پلاس", "داشبورد مدیریت تیم", "اعتبار مشترک", "API اختصاصی", "گزارش مصرف"] },
  { name: "تیم متوسط", desc: "تا ۲۰ کاربر", price: 14990000, color: "#ea580c", features: ["همه امکانات پرو", "داشبورد پیشرفته تیم", "AI-BOS اختصاصی", "SSO / SAML", "مدیر اکانت اختصاصی"], popular: true },
  { name: "سازمانی", desc: "بدون محدودیت", price: null, color: "#8b5cf6", features: ["همه امکانات الفا", "استقرار اختصاصی", "SLA اختصاصی", "یکپارچه‌سازی سفارشی", "پشتیبانی ۲۴/۷"] },
];

const BIZ_PLANS_USD = [
  { name: "Startup", desc: "Up to 5 users", priceUsd: 29900, color: "#6366f1", features: ["All Plus features", "Team dashboard", "Shared credits", "Dedicated API", "Usage reports"] },
  { name: "Growth", desc: "Up to 20 users", priceUsd: 59900, color: "#ea580c", features: ["All Pro features", "Advanced team dashboard", "AI-BOS included", "SSO / SAML", "Dedicated account manager"], popular: true },
  { name: "Enterprise", desc: "Unlimited", priceUsd: null, color: "#8b5cf6", features: ["All Ultra features", "Custom deployment", "Custom SLA", "Custom integrations", "24/7 support"] },
];

const FAQ_IR = [
  { q: "تفاوت پلن‌ها در چیست؟", a: "هر پلن محدودیت متفاوتی در تعداد پیام، تصویر، ویدیو و دسترسی به مدل‌های هوشمند دارد. پلن‌های بالاتر به مدل‌های قوی‌تر و ابزارهای بیشتری دسترسی دارند." },
  { q: "آیا می‌توانم پلن را ارتقا دهم؟", a: "بله، هر زمان می‌توانید پلن بالاتری خریداری کنید." },
  { q: "پرداخت از چه طریقی انجام می‌شود؟", a: "از طریق درگاه امن زرین‌پال با کارت بانکی." },
  { q: "آیا تخفیف سالانه دارید؟", a: "بله، با خرید سالانه ۲ ماه رایگان دریافت می‌کنید (معادل ۱۷٪ تخفیف)." },
  { q: "پشتیبانی چگونه است؟", a: "پلن‌های پلاس و بالاتر پشتیبانی ایمیلی، پرو پشتیبانی اولویت‌دار و الفا پشتیبانی VIP دارند." },
];

const FAQ_EN = [
  { q: "What's the difference between plans?", a: "Each plan has different limits on messages, images, videos, and access to AI models. Higher plans unlock more powerful models and tools." },
  { q: "Can I upgrade my plan?", a: "Yes, you can purchase a higher plan at any time." },
  { q: "How do I pay?", a: "International plans are available via contact. Iranian plans via ZarinPal secure gateway." },
  { q: "Is there an annual discount?", a: "Yes, with annual billing you get 2 months free (≈17% off)." },
  { q: "What about support?", a: "Plus and above get email support, Pro gets priority support, Ultra gets VIP support." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtToman(rial: number, annual: boolean): string {
  const toman = Math.round(rial / 10);
  const final = annual ? Math.round(toman * (1 - ANNUAL_DISCOUNT)) : toman;
  return final.toLocaleString("fa-IR");
}

function fmtUsd(cents: number, annual: boolean): string {
  const usd = cents / 100;
  const final = annual ? Math.round(usd * (1 - ANNUAL_DISCOUNT) * 100) / 100 : usd;
  return `$${final % 1 === 0 ? final.toFixed(0) : final.toFixed(2)}`;
}

function CellVal({ val }: { val: boolean | string }) {
  if (typeof val === "boolean") {
    return val
      ? <Check className="w-4 h-4 mx-auto" style={{ color: "#10b981" }} />
      : <X className="w-4 h-4 mx-auto" style={{ color: "var(--text-muted)", opacity: 0.4 }} />;
  }
  return <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{val}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlansPage() {
  const { lang }                        = useTranslation();
  const isFa                            = lang === "fa";
  const [loading, setLoading]           = useState<string | null>(null);
  const [market, setMarket]             = useState<Market | null>(null); // null = not yet initialized
  const [period, setPeriod]             = useState<Period>("monthly");
  const [packages, setPackages]         = useState<ApiPackage[]>([]);
  const [showTable, setShowTable]       = useState(false);
  const [openFaq, setOpenFaq]           = useState<number | null>(null);
  const searchParams                    = useSearchParams();
  const langInitialized                 = useRef(false);

  // Sync market with language on first load (fa→IR, en→INTL), allow manual override after
  useEffect(() => {
    if (lang && !langInitialized.current) {
      setMarket(lang === "fa" ? "IR" : "INTL");
      langInitialized.current = true;
    }
  }, [lang]);

  useEffect(() => {
    const payStatus = searchParams.get("payment");
    const refId     = searchParams.get("ref");
    if (payStatus === "success") toast.success(isFa ? `اشتراک فعال شد! کد پیگیری: ${refId}` : `Subscription activated! Ref: ${refId}`);
    if (payStatus === "failed")  toast.error(isFa ? "پرداخت ناموفق بود. دوباره تلاش کنید." : "Payment failed. Please try again.");
  }, [searchParams, isFa]);

  useEffect(() => {
    fetch("/api/packages")
      .then(r => r.json())
      .then((d: { packages: ApiPackage[] }) => setPackages(d.packages || []))
      .catch(() => toast.error(isFa ? "خطا در بارگذاری پلن‌ها" : "Failed to load plans"));
  }, []);

  // Coming from registration with a pre-selected plan (landing page → register → here) —
  // trigger checkout automatically once packages are loaded, once only.
  const autoBuyTriggered = useRef(false);
  useEffect(() => {
    const autobuy = searchParams.get("autobuy");
    const planParam = searchParams.get("plan");
    if (autobuy === "1" && planParam && packages.length > 0 && !autoBuyTriggered.current) {
      autoBuyTriggered.current = true;
      handleBuy(planParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, searchParams]);

  const effectiveMarket = market ?? (isFa ? "IR" : "INTL");
  const isIr     = effectiveMarket === "IR";
  const planCodes = isIr ? IR_PLAN_CODES : USD_PLAN_CODES;
  const freePlan  = isIr ? FREE_IR : FREE_USD;

  function getPlans(): (ApiPackage & { parsedFeatures: string[] })[] {
    const paid = packages
      .filter(p => planCodes.includes(p.planCode) && p.planCode !== "FREE")
      .sort((a, b) => planCodes.indexOf(a.planCode) - planCodes.indexOf(b.planCode));

    return [freePlan, ...paid].map(p => ({
      ...p,
      parsedFeatures: ((!isFa && p.featuresEn) || p.features || "").split("\n").filter(Boolean),
    }));
  }

  const plans    = getPlans();
  const bizPlans = isIr ? BIZ_PLANS_IR : BIZ_PLANS_USD;
  const faqItems = isFa ? FAQ_IR : FAQ_EN;

  // i18n strings
  const s = {
    title:        isFa ? "خرید و ارتقا بسته"                    : "Plans & Pricing",
    subtitle:     isFa ? "هوش مصنوعی برای همه — چت، تصویر، موزیک و ویدیو" : "AI for everyone — chat, image, music & video",
    iran:         "🇮🇷 " + (isFa ? "ایران (تومان)" : "Iran (Toman)"),
    intl:         "🌍 " + (isFa ? "بین‌المللی (دلار)" : "International ($)"),
    monthly:      isFa ? "ماهانه"     : "Monthly",
    annual:       isFa ? "سالانه"     : "Annual",
    freeMonths:   isFa ? "۲ ماه رایگان" : "2 months free",
    popular:      isFa ? "پرطرفدار"   : "Popular",
    recommended:  isFa ? "پیشنهادی"   : "Recommended",
    free:         isFa ? "رایگان"     : "Free",
    perMonth:     isFa ? "در ماه"     : "/ mo",
    active:       isFa ? "فعال"       : "Active",
    buy:          isFa ? "خرید"       : "Buy",
    redirecting:  isFa ? "در حال انتقال..." : "Redirecting...",
    contactIntl:  isFa ? "برای خرید پلن بین‌المللی با ما تماس بگیرید." : "Contact us for international plans.",
    payError:     isFa ? "خطا در ایجاد پرداخت" : "Payment error",
    connError:    isFa ? "خطا در اتصال به درگاه" : "Connection error",
    successBanner:isFa ? "اشتراک شما با موفقیت فعال شد!" : "Your subscription was activated!",
    compareBtn:   isFa ? "مقایسه کامل امکانات" : "Full Feature Comparison",
    featuresCol:  isFa ? "امکانات"    : "Features",
    customPrice:  isFa ? "سفارشی"    : "Custom",
    contactUs:    isFa ? "تماس با ما" : "Contact Us",
    getStarted:   isFa ? "شروع کنید" : "Get Started",
    faqTitle:     isFa ? "سؤالات متداول" : "FAQ",
    footerNote:   isFa
      ? "پرداخت از طریق درگاه امن زرین‌پال — اطلاعات کارت شما نزد ما ذخیره نمی‌شود"
      : "Payments processed securely — we never store your card details",
  };

  async function handleBuy(planCode: string) {
    if (planCode === "FREE") return;
    if (!isIr) { toast(s.contactIntl); return; }
    setLoading(planCode);
    try {
      const res  = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planCode, period }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || s.payError);
      window.location.href = data.paymentUrl;
    } catch {
      toast.error(s.connError);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-10 max-w-6xl mx-auto" dir={isFa ? "rtl" : "ltr"}>

      {/* ── Success banner ── */}
      {searchParams.get("payment") === "success" && (
        <div className="p-4 rounded-2xl flex items-center gap-3"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#10b981" }} />
          <p className="font-medium text-sm" style={{ color: "#10b981" }}>{s.successBanner}</p>
        </div>
      )}

      {/* ── Header ── */}
      <div className="text-center space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>

        {/* Market toggle */}
        <div className="inline-flex rounded-2xl p-1 gap-1" style={{ background: "var(--surface-2)" }}>
          {(["IR", "INTL"] as Market[]).map(m => (
            <button key={m} onClick={() => setMarket(m)}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: effectiveMarket === m ? "var(--primary)" : "transparent",
                color: effectiveMarket === m ? "white" : "var(--text-secondary)",
              }}>
              {m === "IR" ? s.iran : s.intl}
            </button>
          ))}
        </div>

        {/* Period toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm" style={{ color: period === "monthly" ? "var(--text-primary)" : "var(--text-muted)" }}>{s.monthly}</span>
          <button
            onClick={() => setPeriod(p => p === "monthly" ? "annual" : "monthly")}
            className="relative w-12 h-6 rounded-full transition-all"
            style={{ background: period === "annual" ? "var(--primary)" : "var(--surface-2)" }}>
            <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
              style={{ [isFa ? "right" : "left"]: period === "annual" ? "0.25rem" : "calc(100% - 1.25rem)" }} />
          </button>
          <span className="text-sm" style={{ color: period === "annual" ? "var(--text-primary)" : "var(--text-muted)" }}>
            {s.annual}
            <span className={isFa ? "mr-1.5" : "ml-1.5"} style={{
              display: "inline-block",
              padding: "0 6px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "white",
              background: "#16a34a",
            }}>
              {s.freeMonths}
            </span>
          </span>
        </div>
      </div>

      {/* ── Plan cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
        {plans.map((plan) => {
          const isFree   = plan.planCode === "FREE";
          const price    = isIr ? plan.price : (plan.priceUsd ?? 0);
          const priceStr = isFree ? s.free
            : isIr ? `${fmtToman(price, period === "annual")} تومان`
            : fmtUsd(price, period === "annual");

          return (
            <div key={plan.planCode}
              className="relative rounded-2xl p-4 flex flex-col"
              style={{
                background: plan.isFeatured ? `${plan.color}15` : "var(--surface-1)",
                border: `2px solid ${plan.isFeatured ? plan.color : "var(--border)"}`,
              }}>

              {plan.isFeatured && (
                <div className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white whitespace-nowrap"
                  style={{ background: plan.color }}>
                  {s.popular}
                </div>
              )}

              <div className="font-bold text-base mb-1" style={{ color: plan.color }}>
                {isFa ? plan.name : plan.nameEn}
              </div>

              <div className="mb-3">
                {isFree ? (
                  <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{s.free}</span>
                ) : (
                  <>
                    <div className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{priceStr}</div>
                    {period === "annual" && (
                      <div className="text-xs line-through mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {isIr ? `${fmtToman(price, false)} تومان` : fmtUsd(price, false)}
                      </div>
                    )}
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.perMonth}</div>
                  </>
                )}
              </div>

              <ul className="space-y-1.5 mb-4 flex-1">
                {plan.parsedFeatures.slice(0, 4).map(f => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                    <span className="text-xs leading-tight" style={{ color: "var(--text-secondary)" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleBuy(plan.planCode)}
                disabled={!!loading || isFree}
                className="w-full py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{
                  background: isFree ? "var(--surface-2)" : plan.isFeatured ? plan.color : `${plan.color}25`,
                  color: isFree ? "var(--text-muted)" : plan.isFeatured ? "white" : plan.color,
                  border: isFree ? "1px solid var(--border)" : "none",
                }}>
                {loading === plan.planCode
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {s.redirecting}</>
                  : isFree ? s.active
                  : <><Zap className="w-3.5 h-3.5" /> {s.buy}</>
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Feature comparison table ── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => setShowTable(t => !t)}
          className="w-full flex items-center justify-between px-5 py-4"
          style={{ background: "var(--surface-1)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{s.compareBtn}</span>
          <ChevronDown className="w-4 h-4 transition-transform" style={{ transform: showTable ? "rotate(180deg)" : "none", color: "var(--text-muted)" }} />
        </button>

        {showTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <th className={`${isFa ? "text-right" : "text-left"} px-4 py-3 font-medium w-44`} style={{ color: "var(--text-secondary)" }}>
                    {s.featuresCol}
                  </th>
                  {plans.map(p => (
                    <th key={p.planCode} className="text-center px-3 py-3 font-bold" style={{ color: p.color }}>
                      {isFa ? p.name : p.nameEn}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map(section => (
                  <>
                    <tr key={section.sectionFa} style={{ background: "var(--surface-0)" }}>
                      <td colSpan={plans.length + 1} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <section.icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                          <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>
                            {isFa ? section.sectionFa : section.sectionEn}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {section.rows.map((row, ri) => (
                      <tr key={row.labelFa} style={{ background: ri % 2 === 0 ? "var(--surface-1)" : "var(--surface-0)" }}>
                        <td className={`px-4 py-2.5 ${isFa ? "text-right" : "text-left"}`}>
                          <div style={{ color: "var(--text-primary)" }}>{isFa ? row.labelFa : row.labelEn}</div>
                          {row.subtitle && <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{row.subtitle}</div>}
                        </td>
                        {(isIr ? row.ir : row.en).map((val, ci) => (
                          <td key={ci} className="text-center px-3 py-2.5">
                            <CellVal val={val} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Business plans ── */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-6 h-6" style={{ color: "var(--primary)" }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {isFa ? "پلن‌های کسب‌وکار" : "Business Plans"}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isFa ? "برای تیم‌ها، آژانس‌ها و سازمان‌ها" : "For teams, agencies and enterprises"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bizPlans.map((biz) => {
            const isCustom = isIr
              ? !("price" in biz) || biz.price == null
              : !("priceUsd" in biz) || (biz as any).priceUsd == null;

            const priceDisplay = isCustom
              ? s.customPrice
              : isIr
                ? `${Math.round(((biz as any).price / 10) * (period === "annual" ? (1 - ANNUAL_DISCOUNT) : 1)).toLocaleString("fa-IR")} تومان`
                : fmtUsd((biz as any).priceUsd, period === "annual");

            return (
              <div key={biz.name}
                className="relative p-5 rounded-2xl flex flex-col"
                style={{
                  background: (biz as any).popular ? `${biz.color}12` : "var(--surface-1)",
                  border: `2px solid ${(biz as any).popular ? biz.color : "var(--border)"}`,
                }}>

                {(biz as any).popular && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ background: biz.color }}>
                    {s.recommended}
                  </div>
                )}

                <div className="font-bold text-base mb-0.5" style={{ color: biz.color }}>{biz.name}</div>
                <div className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{biz.desc}</div>
                <div className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>{priceDisplay}</div>
                {period === "annual" && !isCustom && isIr && (
                  <div className="text-xs line-through mb-3" style={{ color: "var(--text-muted)" }}>
                    {`${Math.round((biz as any).price / 10).toLocaleString("fa-IR")} تومان`}
                  </div>
                )}
                <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{s.perMonth}</div>

                <ul className="space-y-2 flex-1 mb-5">
                  {biz.features.map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: biz.color }} />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="mailto:support@aifekr.com"
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all block"
                  style={{
                    background: (biz as any).popular ? biz.color : `${biz.color}20`,
                    color: (biz as any).popular ? "white" : biz.color,
                  }}>
                  {isCustom ? s.contactUs : s.getStarted}
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Trust / guarantee ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: "🔒", title: isFa ? "پرداخت امن"       : "Secure Payment", desc: isFa ? "درگاه امن زرین‌پال"                   : "SSL-secured checkout" },
          { icon: "♾️", title: isFa ? "بدون انقضا"       : "No Expiry",      desc: isFa ? "اعتبار شما هرگز منقضی نمی‌شود"       : "Credits never expire" },
          { icon: "↩️", title: isFa ? "ضمانت بازگشت"    : "Money-back",     desc: isFa ? "در صورت مشکل وجه برمی‌گردد"          : "Refund if issues arise" },
        ].map(t => (
          <div key={t.title} className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <span className="text-2xl">{t.icon}</span>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{t.title}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FAQ ── */}
      <div>
        <h2 className="text-lg font-bold text-center mb-4" style={{ color: "var(--text-primary)" }}>{s.faqTitle}</h2>
        <div className="max-w-2xl mx-auto space-y-2">
          {faqItems.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium ${isFa ? "text-right" : "text-left"}`}
                style={{ color: "var(--text-primary)" }}>
                {item.q}
                <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform"
                  style={{ transform: openFaq === i ? "rotate(180deg)" : "none", color: "var(--text-muted)" }} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-sm" style={{ color: "var(--text-secondary)" }}>{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs pb-6" style={{ color: "var(--text-muted)" }}>{s.footerNote}</p>
    </div>
  );
}
