"use client";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";

type Policy = { enabled: boolean; signup: number; activationBonus: number; expiryDays: number };

/** Admin → Settings: free credits for new accounts (lib/credits/freeCredits). Off until a super admin turns it on. */
export default function FreeCreditsCard() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/admin/free-credits").then((r) => r.json()).then((d) => setPolicy(d.policy)).catch(() => setMessage("بارگذاری نشد")); }, []);
  async function save(next: Policy) {
    setSaving(true); setMessage("");
    const r = await fetch("/api/admin/free-credits", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (r?.ok) { setPolicy(d.policy); setMessage("ذخیره شد"); } else setMessage(d?.code === "SUPER_ADMIN_REQUIRED" ? "فقط سوپرادمین می‌تواند تغییر دهد" : "ذخیره نشد");
    setSaving(false);
  }
  if (!policy) return <section className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{message || "…"}</section>;
  const field = (key: keyof Omit<Policy, "enabled">, label: string) => (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
      {label}
      <input type="number" min={key === "expiryDays" ? 1 : 0} value={policy[key]} onChange={(e) => setPolicy({ ...policy, [key]: Number(e.target.value) })}
        className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
    </label>
  );
  return (
    <section className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}><Gift className="w-4 h-4" style={{ color: "var(--primary)" }} />اعتبار رایگان کاربران جدید</h2>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: policy.enabled ? "rgba(34,197,94,.15)" : "rgba(234,88,12,.12)", color: policy.enabled ? "#22c55e" : "var(--primary)" }}>{policy.enabled ? "فعال" : "خاموش — منتظر تأیید"}</span>
      </div>
      <p className="text-xs leading-6" style={{ color: "var(--text-muted)" }}>اعتبار ثبت‌نام + پاداش فعال‌سازی (اولین خروجی موفق هوش مصنوعی)، فقط یک بار برای هر حساب تأییدشده (موبایل یا گوگل). هر دو بعد از مهلت منقضی می‌شوند. وقتی خاموش است، ثبت‌نام مثل قبل کار می‌کند.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field("signup", "اعتبار ثبت‌نام")}
        {field("activationBonus", "پاداش فعال‌سازی")}
        {field("expiryDays", "مهلت انقضا (روز)")}
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>جمع: {policy.signup + policy.activationBonus} اعتبار، انقضا بعد از {policy.expiryDays} روز</p>
      <div className="flex gap-2 flex-wrap items-center">
        <button disabled={saving} onClick={() => void save(policy)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>ذخیرهٔ مقادیر</button>
        <button disabled={saving} onClick={() => void save({ ...policy, enabled: !policy.enabled })} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: policy.enabled ? "#64748b" : "var(--primary)" }}>{policy.enabled ? "خاموش کردن" : "تأیید و فعال‌سازی"}</button>
        {message && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{message}</span>}
      </div>
    </section>
  );
}
