"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Check, Zap, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const PLANS = [
  {
    id: "FREE", name: "رایگان", price: 0, color: "#71717a",
    features: ["۲۰ پیام در روز", "۵ تصویر در ماه", "مدل پایه (Haiku)", "بدون ویدیو و موزیک"],
  },
  {
    id: "BASIC", name: "پایه", price: 150000, color: "#3b82f6",
    features: ["پیام نامحدود", "۵۰ تصویر در ماه", "۵ ویدیو در ماه", "مدل پیشرفته (Sonnet)", "اولویت پردازش"],
  },
  {
    id: "PRO", name: "حرفه‌ای", price: 350000, color: "#ea580c", popular: true,
    features: ["همه چیز نامحدود", "مدل برتر (Opus)", "API دسترسی", "پشتیبانی اولویت", "تصویر و ویدیو HD"],
  },
  {
    id: "TEAM", name: "تیمی", price: 800000, color: "#8b5cf6",
    features: ["تا ۵ نفر", "همه امکانات Pro", "داشبورد مشترک", "مدیریت اعضا", "فاکتور رسمی"],
  },
];

export default function PlansPage() {
  const [loading, setLoading] = useState<string | null>(null);
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
    <div className="p-6 space-y-6">
      {paymentStatus === "success" && (
        <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} />
          <div>
            <p className="font-medium text-sm" style={{ color: "#10b981" }}>اشتراک شما با موفقیت فعال شد!</p>
            {refId && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>کد پیگیری: {refId}</p>}
          </div>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>انتخاب پلن</h1>
        <p style={{ color: "var(--text-secondary)" }}>پلن مناسب خود را انتخاب کنید</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 max-w-5xl mx-auto">
        {PLANS.map(plan => (
          <div key={plan.id} className="p-5 rounded-2xl relative"
            style={{ background: "var(--surface-1)", border: `2px solid ${(plan as any).popular ? plan.color : "var(--border)"}` }}>
            {(plan as any).popular && (
              <div className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: plan.color }}>
                محبوب‌ترین
              </div>
            )}
            <div className="mb-4">
              <div className="font-bold text-lg mb-1" style={{ color: "var(--text-primary)" }}>{plan.name}</div>
              <div className="text-2xl font-bold" style={{ color: plan.color }}>
                {plan.price === 0 ? "رایگان" : (plan.price / 10).toLocaleString("fa-IR") + " ت"}
              </div>
              {plan.price > 0 && <div className="text-xs" style={{ color: "var(--text-muted)" }}>در ماه</div>}
            </div>

            <ul className="space-y-2 mb-5">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: plan.color }} />
                  <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleBuy(plan.id)}
              disabled={plan.price === 0 || loading === plan.id}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              style={{
                background: (plan as any).popular ? plan.color : "var(--surface-2)",
                color: (plan as any).popular ? "white" : "var(--text-primary)",
              }}>
              {loading === plan.id
                ? <><Loader2 className="w-4 h-4 animate-spin" /> در حال انتقال...</>
                : plan.price === 0 ? "پلن فعلی" : <><Zap className="w-4 h-4" /> خرید اشتراک</>}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
        پرداخت از طریق درگاه امن زرین‌پال · در محیط آزمایشی بدون پرداخت واقعی
      </p>
    </div>
  );
}
