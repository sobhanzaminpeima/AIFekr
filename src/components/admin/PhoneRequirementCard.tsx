"use client";
import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

type State = { enabled: boolean; users: number; usersWithoutPhone: number };

/** Admin → Settings: mandatory mobile number (lib/auth/phoneRequirement). On by default; switching it off is the instant rollback. */
export default function PhoneRequirementCard() {
  const [s, setS] = useState<State | null>(null), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/admin/phone-requirement").then(r => r.json()).then(setS).catch(() => setMsg("بارگذاری نشد")); }, []);
  async function toggle() {
    if (!s) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/phone-requirement", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !s.enabled }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (r?.ok) { setS({ ...s, enabled: d.enabled }); setMsg("ذخیره شد"); } else setMsg(d?.code === "SUPER_ADMIN_REQUIRED" ? "فقط سوپرادمین می‌تواند تغییر دهد" : "ذخیره نشد");
    setBusy(false);
  }
  if (!s) return <section className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{msg || "…"}</section>;
  return (
    <section className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}><Smartphone className="w-4 h-4" style={{ color: "var(--primary)" }} />شماره موبایل اجباری</h2>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: s.enabled ? "rgba(34,197,94,.15)" : "rgba(234,88,12,.12)", color: s.enabled ? "#22c55e" : "var(--primary)" }}>{s.enabled ? "فعال" : "غیرفعال"}</span>
      </div>
      <p className="text-xs leading-6" style={{ color: "var(--text-muted)" }}>
        وقتی فعال است، ثبت‌نام بدون موبایل پذیرفته نمی‌شود و هر کاربری که موبایل ندارد (از جمله ورود با گوگل) پیش از ادامه، صفحهٔ «ثبت شماره موبایل» را می‌بیند. مدیران از این مرحله معاف‌اند.
        اکنون {s.usersWithoutPhone.toLocaleString("fa-IR")} کاربر از {s.users.toLocaleString("fa-IR")} کاربر موبایل ندارند.
      </p>
      <div className="flex gap-2 flex-wrap items-center">
        <button disabled={busy} onClick={() => void toggle()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: s.enabled ? "#64748b" : "var(--primary)" }}>{s.enabled ? "غیرفعال کردن" : "فعال کردن"}</button>
        {msg && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{msg}</span>}
      </div>
    </section>
  );
}
