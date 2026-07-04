"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Check, Zap, Loader2, CheckCircle, Tag, ChevronDown, Gift, Infinity as InfinityIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";

const DISCOUNT_PERCENT = 20;

// originalPrice/credits must match LIST_PRICES in api/payment/create/route.ts —
// that file applies the same DISCOUNT_PERCENT to compute the real charge.
const PLANS = [
  {
    id: "FREE", name: "رایگان", originalPrice: 0, credits: 100, color: "#71717a",
    features: ["۲۰ چت در روز", "۵ تصویر در ماه", "مدل پایه", "بدون ویدیو و موزیک"],
  },
  {
    id: "BASIC", name: "پایه", originalPrice: 150000, credits: 2000, color: "#3b82f6",
    features: ["چت نامحدود", "۵۰ تصویر در ماه", "۵ ویدیو در ماه", "مدل پیشرفته", "اولویت پردازش"],
  },
  {
    id: "PRO", name: "حرفه‌ای", originalPrice: 350000, credits: 6000, color: "#ea580c", popular: true,
    features: ["همه‌چیز نامحدود", "مدل برتر", "پشتیبانی اولویت", "تصویر و ویدیو HD"],
  },
  {
    id: "TEAM", name: "تیمی", originalPrice: 800000, credits: 20000, color: "#8b5cf6",
    features: ["تا ۵ نفر", "همه امکانات حرفه‌ای", "داشبورد مشترک", "مدیریت اعضا", "فاکتور رسمی"],
  },
].map((p) => ({ ...p, price: Math.round(p.originalPrice * (1 - DISCOUNT_PERCENT / 100)) }));

// Real per-operation credit costs — mirrors src/lib/utils/credits.ts CREDIT_COSTS.
const OPERATION_COSTS: Record<string, { label: string; rows: { name: string; credits: number }[] }> = {
  chat: { label: "چت", rows: [{ name: "هر پیام چت", credits: 1 }] },
  image: {
    label: "تصویر",
    rows: [
      { name: "تصویر استاندارد", credits: 5 },
      { name: "تصویر HD", credits: 10 },
    ],
  },
  video: {
    label: "ویدیو",
    rows: [
      { name: "ویدیو ۵ ثانیه", credits: 20 },
      { name: "ویدیو ۱۰ ثانیه", credits: 35 },
      { name: "ویدیو ۳۰ ثانیه", credits: 80 },
    ],
  },
  music: {
    label: "موزیک",
    rows: [
      { name: "موزیک ۳۰ ثانیه", credits: 10 },
      { name: "موزیک ۶۰ ثانیه", credits: 18 },
      { name: "موزیک ۱۲۰ ثانیه", credits: 30 },
    ],
  },
};

const FAQ = [
  { q: "تفاوت پلن پایه و حرفه‌ای چیست؟", a: "پلن حرفه‌ای محدودیت ماهانه‌ی تصویر و ویدیو ندارد، از مدل قوی‌تر استفاده می‌کند و پشتیبانی اولویت‌دار دارد." },
  { q: "آیا اعتبار خریداری‌شده تاریخ انقضا دارد؟", a: "خیر، اعتبار خریداری‌شده در همان پلن باقی می‌ماند تا زمانی که مصرف شود و پس از آن نیازمند تمدید یا خرید مجدد اعتبار خواهید بود." },
  { q: "هر تولید چند اعتبار مصرف می‌کند؟", a: "بسته به نوع عملیات (چت، تصویر، ویدیو یا موزیک) متفاوت است — جدول کامل را در بخش «اعتبار هر عملیات» در همین صفحه ببینید." },
  { q: "می‌توانم پلن را ارتقا دهم؟", a: "بله، هر زمان می‌توانید یک پلن بالاتر بخرید؛ اعتبار پلن جدید به اعتبار فعلی حساب شما اضافه می‌شود." },
  { q: "آیا اعتبار خرج‌نشده بعد از پایان اشتراک از بین می‌رود؟", a: "خیر، اعتبار باقی‌مانده از بین نمی‌رود و در دوره‌ی بعدی هم قابل استفاده است." },
  { q: "پرداخت از چه طریقی انجام می‌شود؟", a: "پرداخت از طریق درگاه امن زرین‌پال انجام می‌شود." },
];

export default function PlansPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<keyof typeof OPERATION_COSTS>("chat");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");
  const refId = searchParams.get("ref");

  useEffect(() => {
    if (paymentStatus === "success") toast.success(`پرداخت موفق! کد پیگیری: ${refId}`);
    if (paymentStatus === "failed") toast.error("پرداخت ناموفق بود. دوباره تلاش کنید.");
  }, [paymentStatus, refId]);

  async function handleBuy(planId: string) {
    if (planId === "FREE") return;
    setLoading(planId);
    const res = await fetch("/api/payment/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) return toast.error(data.error || "خطا در ایجاد پرداخت");
    window.location.href = data.paymentUrl;
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {paymentStatus === "success" && (
        <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} />
          <div>
            <p className="font-medium text-sm" style={{ color: "#10b981" }}>اشتراک شما با موفقیت فعال شد!</p>
            {refId && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>کد پیگیری: {refId}</p>}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>خرید اعتبار</h1>
        <p className="max-w-xl mx-auto text-sm" style={{ color: "var(--text-secondary)" }}>
          اعتبار، واحد مصرفی AiFekr برای استفاده از ابزارهای هوش مصنوعی است. هر مدل به اندازه‌ی مصرف واقعی خودش از حساب شما اعتبار کم می‌کند.
        </p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: "#16a34a" }}>
          <Tag className="w-3.5 h-3.5" />
          {DISCOUNT_PERCENT}٪ تخفیف ویژه روی همه‌ی پلن‌ها
        </div>
      </div>

      {/* Free banner */}
      <div className="p-5 rounded-2xl text-center max-w-md mx-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="font-bold mb-1" style={{ color: "var(--text-primary)" }}>رایگان — ۲۰ چت در هر روز</div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>با محدودیت مدل پایه — بدون نیاز به خرید</div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {PLANS.filter((p) => p.id !== "FREE").map((plan) => {
          const perCredit = plan.credits > 0 ? plan.price / plan.credits : 0;
          return (
            <div key={plan.id} className="p-5 rounded-2xl relative"
              style={{ background: "var(--surface-1)", border: `2px solid ${(plan as any).popular ? plan.color : "var(--border)"}` }}>
              {(plan as any).popular && (
                <div className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: plan.color }}>
                  محبوب‌ترین
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>{plan.name}</div>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: "#16a34a" }}>
                  {DISCOUNT_PERCENT}٪ تخفیف
                </span>
              </div>

              <div className="flex items-center gap-1.5 mb-1">
                <Gift className="w-4 h-4" style={{ color: plan.color }} />
                <span className="text-2xl font-bold" style={{ color: plan.color }}>{plan.credits.toLocaleString("fa-IR")}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>اعتبار</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm line-through" style={{ color: "var(--text-muted)" }}>
                  {(plan.originalPrice / 10).toLocaleString("fa-IR")} ت
                </span>
                <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {(plan.price / 10).toLocaleString("fa-IR")} ت
                </span>
              </div>
              <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                هر اعتبار {perCredit.toLocaleString("fa-IR", { maximumFractionDigits: 0 })} تومان
              </div>

              <ul className="space-y-2 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: plan.color }} />
                    <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleBuy(plan.id)}
                disabled={loading === plan.id}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                style={{
                  background: (plan as any).popular ? plan.color : "var(--surface-2)",
                  color: (plan as any).popular ? "white" : "var(--text-primary)",
                }}>
                {loading === plan.id
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> در حال انتقال...</>
                  : <><Zap className="w-4 h-4" /> خرید اعتبار</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Non-expiring credits note */}
      <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <InfinityIcon className="w-6 h-6 flex-shrink-0" style={{ color: "var(--primary)" }} />
        <div>
          <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>اعتبار دائمی، بدون انقضا</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>اعتبار خریداری‌شده هرگز منقضی نمی‌شود و تا زمان مصرف کامل در حساب شما باقی می‌ماند.</div>
        </div>
      </div>

      {/* Per-operation cost table */}
      <div>
        <h2 className="text-lg font-bold text-center mb-1" style={{ color: "var(--text-primary)" }}>اعتبار هر عملیات</h2>
        <p className="text-center text-sm mb-4" style={{ color: "var(--text-muted)" }}>هر تولید چند اعتبار مصرف می‌کند</p>

        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          {(Object.keys(OPERATION_COSTS) as (keyof typeof OPERATION_COSTS)[]).map((key) => (
            <button key={key} onClick={() => setTab(key)}
              className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: tab === key ? "var(--primary)" : "var(--surface-2)", color: tab === key ? "white" : "var(--text-secondary)" }}>
              {OPERATION_COSTS[key].label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden max-w-lg mx-auto" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>عملیات</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>هزینه اعتبار</th>
              </tr>
            </thead>
            <tbody>
              {OPERATION_COSTS[tab].rows.map((r, i) => (
                <tr key={r.name} style={{ background: i % 2 === 0 ? "var(--surface-1)" : "var(--surface-0)" }}>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{r.name}</td>
                  <td className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--primary)" }}>{r.credits} اعتبار</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan comparison table */}
      <div>
        <h2 className="text-lg font-bold text-center mb-4" style={{ color: "var(--text-primary)" }}>مقایسه‌ی پلن‌ها</h2>
        <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["پلن", "قیمت اصلی", "تخفیف", "قیمت نهایی", "اعتبار"].map((h) => (
                  <th key={h} className="text-right px-4 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANS.filter((p) => p.id !== "FREE").map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--surface-1)" : "var(--surface-0)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: p.color }}>{p.name}</td>
                  <td className="px-4 py-2.5 line-through" style={{ color: "var(--text-muted)" }}>{(p.originalPrice / 10).toLocaleString("fa-IR")} ت</td>
                  <td className="px-4 py-2.5" style={{ color: "#16a34a" }}>{DISCOUNT_PERCENT}٪</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text-primary)" }}>{(p.price / 10).toLocaleString("fa-IR")} ت</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{p.credits.toLocaleString("fa-IR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-bold text-center mb-4" style={{ color: "var(--text-primary)" }}>سؤالات متداول</h2>
        <div className="max-w-2xl mx-auto space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-right"
                style={{ color: "var(--text-primary)" }}
              >
                {item.q}
                <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ transform: openFaq === i ? "rotate(180deg)" : "none", color: "var(--text-muted)" }} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-sm" style={{ color: "var(--text-secondary)" }}>{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
        پرداخت از طریق درگاه امن زرین‌پال
      </p>
    </div>
  );
}
