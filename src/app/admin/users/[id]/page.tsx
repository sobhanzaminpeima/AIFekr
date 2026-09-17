"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Loader2, MessageSquare, Image as ImageIcon, Video, Wallet, Ban, UserCheck } from "lucide-react";
import { toJalali, formatNumber } from "@/lib/utils/jalali";
import toast from "react-hot-toast";
import { COUNTRIES, dialCodeFor } from "@/lib/constants/countries";

const CURRENCY_OPTIONS = [
  { value: "", label: "پیش‌فرض (بر اساس زبان)" },
  { value: "IRT", label: "تومان" },
  { value: "USD", label: "دلار" },
  { value: "EUR", label: "یورو" },
];

interface Payment {
  id: string;
  amount: number;
  plan: string;
  status: string;
  gateway: string;
  refId?: string;
  createdAt: string;
}

interface UsageLog {
  id: string;
  type: string;
  model?: string;
  credits: number;
  createdAt: string;
}

interface UserDetail {
  id: string;
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  currency?: string | null;
  email?: string;
  phone?: string;
  role: string;
  plan: string;
  credits: number;
  planExpiry?: string;
  isBlocked: boolean;
  createdAt: string;
  lastLoginAt?: string;
  crmPlan?: string;
  crmPlanExpiry?: string;
  commissionPercentOverride?: number | null;
  _count: { conversations: number; images: number; videos: number; payments: number };
  payments: Payment[];
  usageLogs: UsageLog[];
}

interface ModuleRow {
  key: string;
  category: "crm" | "agent";
  labelFa: string;
  labelEn: string;
  industrySlug: string;
  override: boolean | null; // null = pack default applies
}

const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  FREE: { label: "رایگان", color: "#71717a" },
  BASIC: { label: "پایه", color: "#3b82f6" },
  PRO: { label: "حرفه‌ای", color: "#ea580c" },
  TEAM: { label: "تیمی", color: "#8b5cf6" },
};

const CRM_PLAN_LABEL: Record<string, { label: string; color: string }> = {
  NONE: { label: "بدون CRM", color: "#71717a" },
  SOLO: { label: "CRM انفرادی", color: "#0ea5e9" },
  TEAM: { label: "CRM تیمی", color: "#0ea5e9" },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "در انتظار", color: "#f59e0b" },
  SUCCESS: { label: "موفق", color: "#10b981" },
  FAILED: { label: "ناموفق", color: "#ef4444" },
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commissionInput, setCommissionInput] = useState("");
  const [savingCommission, setSavingCommission] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", country: "", currency: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [modules, setModules] = useState<ModuleRow[] | null>(null);
  const [savingModuleKey, setSavingModuleKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "خطا در بارگذاری"); return; }
      setUser(data.user);
      setCommissionInput(data.user.commissionPercentOverride != null ? String(data.user.commissionPercentOverride) : "");
      setProfileForm({
        firstName: data.user.firstName || "",
        lastName: data.user.lastName || "",
        country: data.user.country || "",
        currency: data.user.currency || "",
        phone: data.user.phone || "",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadModules() {
    try {
      const res = await fetch(`/api/admin/users/${id}/module-overrides`);
      const data = await res.json();
      if (res.ok) setModules(data.modules || []);
    } catch { /* module toggles are a nicety on this page, never block the rest of it */ }
  }

  useEffect(() => { if (id) { load(); loadModules(); } }, [id]);

  // enabled: true/false sets an explicit per-user override; null clears it
  // back to whatever the user's industry pack defaults to.
  async function setModuleOverride(moduleKey: string, enabled: boolean | null) {
    setSavingModuleKey(moduleKey);
    try {
      const res = await fetch(`/api/admin/users/${id}/module-overrides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, enabled }),
      });
      if (!res.ok) { toast.error("خطا در بروزرسانی ماژول"); return; }
      setModules((prev) => prev && prev.map((m) => (m.key === moduleKey ? { ...m, override: enabled } : m)));
    } finally {
      setSavingModuleKey(null);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileForm.firstName.trim() || null,
          lastName: profileForm.lastName.trim() || null,
          country: profileForm.country || null,
          currency: profileForm.currency || null,
          phone: profileForm.phone.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.error(data?.error || "خطا در بروزرسانی"); return; }
      toast.success("اطلاعات کاربر بروزرسانی شد");
      load();
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCommissionOverride() {
    setSavingCommission(true);
    try {
      const value = commissionInput.trim() === "" ? null : Number(commissionInput);
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
        toast.error("درصد باید بین ۰ تا ۱۰۰ باشد"); return;
      }
      await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionPercentOverride: value }),
      });
      toast.success("درصد کمیسیون اختصاصی ذخیره شد");
      load();
    } finally {
      setSavingCommission(false);
    }
  }

  async function toggleBlock() {
    if (!user) return;
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked: !user.isBlocked }),
    });
    toast.success(user.isBlocked ? "کاربر آزاد شد" : "کاربر مسدود شد");
    load();
  }

  async function setCrmPlan(crmPlan: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crmPlan, crmPlanExpiry: crmPlan === "NONE" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }),
    });
    toast.success("پلن CRM بروزرسانی شد");
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (!user) {
    return <div className="p-6" style={{ color: "var(--text-secondary)" }}>کاربر یافت نشد</div>;
  }

  const badge = PLAN_BADGE[user.plan] || PLAN_BADGE.FREE;

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => router.push("/admin/users")}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowRight className="w-4 h-4" /> بازگشت به لیست کاربران
      </button>

      {/* Header card */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{user.name || "بدون نام"}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: badge.color + "22", color: badge.color }}>
              {badge.label}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs" style={{
              background: user.isBlocked ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
              color: user.isBlocked ? "var(--danger)" : "var(--success)",
            }}>
              {user.isBlocked ? "مسدود" : "فعال"}
            </span>
          </div>
          <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }} dir="ltr">
            {[user.email, user.phone].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            عضویت از {toJalali(user.createdAt)}
            {user.lastLoginAt && ` · آخرین ورود ${toJalali(user.lastLoginAt)}`}
            {user.planExpiry && ` · انقضای پلن ${toJalali(user.planExpiry)}`}
          </div>
        </div>
        <button
          onClick={toggleBlock}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--surface-2)", color: user.isBlocked ? "var(--success)" : "var(--danger)" }}
        >
          {user.isBlocked ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
          {user.isBlocked ? "آزادسازی کاربر" : "مسدودسازی کاربر"}
        </button>
      </div>

      {/* Profile info — name split, country, display currency */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>اطلاعات شخصی</span>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>نام</label>
            <input value={profileForm.firstName} onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>نام خانوادگی</label>
            <input value={profileForm.lastName} onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>کشور</label>
            <select value={profileForm.country} onChange={(e) => setProfileForm((p) => ({ ...p, country: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">—</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.fa}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>ارز نمایشی</label>
            <select value={profileForm.currency} onChange={(e) => setProfileForm((p) => ({ ...p, currency: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              موبایل
              {profileForm.country && dialCodeFor(profileForm.country) && (
                <span className="mr-1" style={{ color: "var(--text-muted)" }}>(کد کشور: {dialCodeFor(profileForm.country)})</span>
              )}
            </label>
            {/* Existing phone values are already stored in full international
                format (see /register's own composedPhone logic) -- this field
                intentionally keeps accepting/saving the raw string the admin
                types rather than re-composing it from the country dropdown,
                so editing an existing user's phone can't silently double up
                or strip a dial code that's already baked into the stored
                value. The dial-code hint above is just a visual aid tied to
                the "کشور" dropdown, matching what /register and the invite
                form show. */}
            <input value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} dir="ltr"
              placeholder={profileForm.country && dialCodeFor(profileForm.country) ? `${dialCodeFor(profileForm.country)}123456789` : "09123456789"}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <button onClick={saveProfile} disabled={savingProfile}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {savingProfile ? "..." : "ذخیره اطلاعات"}
        </button>
      </div>

      {/* CRM add-on */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>افزونه CRM</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: (CRM_PLAN_LABEL[user.crmPlan || "NONE"].color) + "22", color: CRM_PLAN_LABEL[user.crmPlan || "NONE"].color }}>
              {CRM_PLAN_LABEL[user.crmPlan || "NONE"].label}
            </span>
          </div>
          {user.crmPlanExpiry && <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>انقضا: {toJalali(user.crmPlanExpiry)}</div>}
        </div>
        <select value={user.crmPlan || "NONE"} onChange={(e) => setCrmPlan(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="NONE">بدون CRM</option>
          <option value="SOLO">CRM انفرادی</option>
          <option value="TEAM">CRM تیمی</option>
        </select>
      </div>

      {/* Per-user module toggles (e.g. enabling just "Property Management"
          for a real-estate user) -- independent of the pack-level defaults;
          "پیش‌فرض پکیج" clears the override and falls back to those. */}
      {modules && modules.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>ماژول‌های اختصاصی این کاربر</span>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>پیش‌فرض هر ماژول از پک صنعتی کاربر می‌آید — اینجا فقط می‌تونید برای همین کاربر جداگانه فعال/غیرفعال کنید.</p>
          </div>
          <div className="space-y-1.5">
            {modules.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{m.labelFa}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {([
                    { value: true, label: "فعال" },
                    { value: false, label: "غیرفعال" },
                    { value: null, label: "پیش‌فرض پکیج" },
                  ] as const).map((opt) => (
                    <button
                      key={String(opt.value)}
                      disabled={savingModuleKey === m.key}
                      onClick={() => setModuleOverride(m.key, opt.value)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                      style={{
                        background: m.override === opt.value ? "var(--primary)" : "var(--surface-1)",
                        color: m.override === opt.value ? "white" : "var(--text-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referral commission override */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>درصد کمیسیون رفرال اختصاصی</span>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>خالی = استفاده از درصد پیش‌فرض سراسری (تنظیمات افیلیت). فقط برای این کاربر جایگزین می‌شود.</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={commissionInput} onChange={(e) => setCommissionInput(e.target.value)} type="number" min={0} max={100} step={0.5}
            placeholder="پیش‌فرض" dir="ltr"
            className="w-28 px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>٪</span>
          <button onClick={saveCommissionOverride} disabled={savingCommission}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {savingCommission ? "..." : "ذخیره"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: Wallet, label: "اعتبار", value: formatNumber(user.credits) },
          { icon: MessageSquare, label: "گفتگوها", value: formatNumber(user._count.conversations) },
          { icon: ImageIcon, label: "تصاویر", value: formatNumber(user._count.images) },
          { icon: Video, label: "ویدیوها", value: formatNumber(user._count.videos) },
          { icon: Wallet, label: "پرداخت‌ها", value: formatNumber(user._count.payments) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <s.icon className="w-4 h-4 mb-2" style={{ color: "var(--text-muted)" }} />
            <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent payments */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 font-medium text-sm" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border)" }}>
          آخرین پرداخت‌ها
        </div>
        {user.payments.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>پرداختی ثبت نشده است</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["پلن", "مبلغ (تومان)", "درگاه", "وضعیت", "تاریخ"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {user.payments.map((p) => {
                const st = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.PENDING;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{PLAN_BADGE[p.plan]?.label || p.plan}</td>
                    <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{formatNumber(p.amount)}</td>
                    <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{p.gateway}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: st.color + "22", color: st.color }}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{toJalali(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Usage log */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 font-medium text-sm" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border)" }}>
          آخرین فعالیت‌ها
        </div>
        {user.usageLogs.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>فعالیتی ثبت نشده است</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["نوع", "مدل", "اعتبار مصرفی", "تاریخ"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {user.usageLogs.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>{u.type}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{u.model || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{formatNumber(u.credits)}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{toJalali(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
