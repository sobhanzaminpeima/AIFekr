"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Settings, Save, Globe, Bell, Shield, Palette, DollarSign } from "lucide-react";
import toast from "react-hot-toast";

const SECTIONS = [
  {
    id: "general", label: "اطلاعات سایت", icon: Globe,
    fields: [
      { key: "site_name", label: "نام سایت (انگلیسی)", type: "text", default: "AiFekr" },
      { key: "site_name_fa", label: "نام سایت (فارسی)", type: "text", default: "هوشمند AI" },
      { key: "site_description", label: "توضیحات", type: "textarea", default: "پلتفرم هوش مصنوعی کسب‌وکار — AiFekr" },
      { key: "site_url", label: "آدرس سایت", type: "text", default: "http://193.162.129.138" },
      { key: "admin_email", label: "ایمیل ادمین", type: "text", default: "admin@aifekr.com" },
      { key: "support_email", label: "ایمیل پشتیبانی", type: "text", default: "support@aifekr.com" },
      { key: "support_phone", label: "تلفن پشتیبانی", type: "text", default: "021-12345678" },
      { key: "logo_url", label: "آدرس لوگو", type: "text", default: "/logo.svg" },
    ],
  },
  {
    id: "ai", label: "تنظیمات AI", icon: Settings,
    fields: [
      { key: "default_model", label: "مدل پیش‌فرض", type: "select", default: "claude-haiku-4-5-20251001", options: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"] },
      { key: "max_tokens", label: "حداکثر توکن", type: "number", default: "4096" },
      { key: "free_daily_messages", label: "پیام رایگان روزانه", type: "number", default: "20" },
      { key: "free_monthly_images", label: "تصویر رایگان ماهانه", type: "number", default: "5" },
      { key: "free_credits", label: "اعتبار اولیه کاربر جدید", type: "number", default: "200" },
    ],
  },
  {
    id: "language", label: "زبان و محلی‌سازی", icon: Globe,
    fields: [
      { key: "default_language", label: "زبان پیش‌فرض سایت", type: "select", default: "fa", options: ["fa", "en"] },
      { key: "calendar_type", label: "نوع تقویم", type: "select", default: "jalali", options: ["jalali", "gregorian"] },
    ],
  },
  {
    id: "currency", label: "ارز و پرداخت", icon: DollarSign,
    fields: [
      { key: "default_currency", label: "ارز پیش‌فرض", type: "select", default: "USD", options: ["USD", "EUR", "IRR", "AED", "GBP"] },
      { key: "usd_to_irr", label: "نرخ تبدیل: ۱ دلار = چند ریال", type: "number", default: "600000" },
      { key: "usd_to_aed", label: "نرخ تبدیل: ۱ دلار = چند درهم", type: "number", default: "3.67" },
      { key: "usd_to_eur", label: "نرخ تبدیل: ۱ دلار = چند یورو", type: "number", default: "0.92" },
      { key: "usd_to_gbp", label: "نرخ تبدیل: ۱ دلار = چند پوند", type: "number", default: "0.79" },
      { key: "payment_gateway", label: "درگاه پرداخت", type: "select", default: "zarinpal", options: ["zarinpal", "stripe", "paypal"] },
      { key: "zarinpal_merchant", label: "کد Zarinpal Merchant", type: "text", default: "" },
      { key: "stripe_key", label: "Stripe Public Key", type: "text", default: "" },
    ],
  },
  {
    id: "appearance", label: "ظاهر و برندینگ", icon: Palette,
    fields: [
      { key: "primary_color", label: "رنگ اصلی", type: "color", default: "#ea580c" },
      { key: "site_tagline", label: "شعار سایت", type: "text", default: "Artificial Intelligence & Insight" },
      { key: "favicon_url", label: "آدرس Favicon", type: "text", default: "/favicon.ico" },
      { key: "footer_text", label: "متن فوتر", type: "text", default: "2025 AiFekr" },
    ],
  },
  {
    id: "notifications", label: "اعلان‌ها", icon: Bell,
    fields: [
      { key: "enable_email_notifications", label: "اعلان ایمیل", type: "toggle", default: "true" },
      { key: "enable_sms", label: "اعلان SMS", type: "toggle", default: "false" },
      { key: "admin_notification_email", label: "ایمیل اعلان ادمین", type: "text", default: "admin@aifekr.com" },
    ],
  },
  {
    id: "security", label: "امنیت", icon: Shield,
    fields: [
      { key: "otp_expiry_minutes", label: "مدت انقضا OTP (دقیقه)", type: "number", default: "10" },
      { key: "jwt_expiry_minutes", label: "مدت انقضا توکن (دقیقه)", type: "number", default: "15" },
      { key: "max_login_attempts", label: "حداکثر تلاش ورود", type: "number", default: "5" },
      { key: "maintenance_mode", label: "حالت تعمیرات", type: "toggle", default: "false" },
    ],
  },
];

type FieldMap = Record<string, string>;

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [values, setValues] = useState<FieldMap>(() => {
    const m: FieldMap = {};
    SECTIONS.forEach(s => s.fields.forEach(f => { m[f.key] = f.default; }));
    return m;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.settings) setValues(prev => ({ ...prev, ...data.settings }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("تنظیمات ذخیره شد");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  const section = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>تنظیمات سایت</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>پیکربندی پلتفرم AiFekr</p>
        </div>
        <button onClick={handleSave} disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}>
          <Save className="w-4 h-4" />{saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-52 flex-shrink-0 space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-right transition-all"
              style={{ background: activeSection === s.id ? "rgba(234,88,12,0.12)" : "transparent", color: activeSection === s.id ? "var(--primary)" : "var(--text-secondary)" }}>
              <s.icon className="w-4 h-4 flex-shrink-0" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          {loading ? (
            <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>
          ) : (
            <>
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{section.label}</h2>
              {section.fields.map(f => (
                <div key={f.key}>
                  <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea value={values[f.key] ?? f.default} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} rows={3}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  ) : f.type === "toggle" ? (
                    <button onClick={() => setValues(v => ({ ...v, [f.key]: v[f.key] === "true" ? "false" : "true" }))}
                      className="relative w-11 h-6 rounded-full transition-all"
                      style={{ background: values[f.key] === "true" ? "var(--primary)" : "var(--surface-2)" }}>
                      <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ right: values[f.key] === "true" ? "4px" : "calc(100% - 20px)" }} />
                    </button>
                  ) : f.type === "select" ? (
                    <select value={values[f.key] ?? f.default} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      {(f as { options?: string[] }).options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "color" ? (
                    <div className="flex items-center gap-3">
                      <input type="color" value={values[f.key] ?? f.default} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                        className="w-10 h-10 rounded-xl cursor-pointer" style={{ border: "none" }} />
                      <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>{values[f.key]}</span>
                    </div>
                  ) : (
                    <input type={f.type} value={values[f.key] ?? f.default} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" dir="ltr"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
