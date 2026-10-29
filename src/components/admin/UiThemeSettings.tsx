"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Eye, EyeOff } from "lucide-react";

type ThemeState = { active: "classic" | "v2"; preview: "classic" | "v2" | null; v2Configured: boolean; v2Healthy: boolean; readyRoutes: string[] };

const THEMES = [
  { id: "classic", title: "تم ۱ · کلاسیک", text: "طراحی فعلی AiFekr. همهٔ صفحه‌ها کامل و همیشه در دسترس است." },
  { id: "v2", title: "تم ۲ · طراحی جدید", text: "Warm Intelligence. فقط صفحه‌هایی که کامل و به بک‌اند وصل شده‌اند با این تم باز می‌شوند؛ بقیه خودکار با تم کلاسیک نمایش داده می‌شوند." },
] as const;

/** Site-wide theme (super admin) and a preview that only changes this admin's own browser. */
export default function UiThemeSettings() {
  const [state, setState] = useState<ThemeState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/admin/ui-theme", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setState).catch(() => setState(null)); }, []);
  async function send(change: { active?: "classic" | "v2"; preview?: "classic" | "v2" | null }) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ui-theme", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.code === "SUPER_ADMIN_REQUIRED" ? "فقط سوپر ادمین می‌تواند تم سایت را عوض کند" : "ذخیره نشد");
      setState(data);
      toast.success(change.active ? "تم سایت ذخیره شد؛ تا ۳۰ ثانیه برای همه اعمال می‌شود" : "پیش‌نمایش این مرورگر به‌روز شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }
  if (!state) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>در حال بارگذاری…</p>;
  const ready = state.readyRoutes.length;
  const status = !state.v2Configured ? "اپ طراحی جدید هنوز روی سرور راه‌اندازی نشده است؛ همهٔ صفحه‌ها با تم کلاسیک نمایش داده می‌شوند."
    : !state.v2Healthy ? "اپ طراحی جدید الان پاسخ نمی‌دهد؛ تا برگشتن آن، همه چیز خودکار با تم کلاسیک نمایش داده می‌شود."
    : ready ? `${ready.toLocaleString("fa-IR")} بخش در طراحی جدید آماده است.` : "هنوز هیچ صفحه‌ای در طراحی جدید آماده نشده است.";
  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>تم فقط ظاهر را عوض می‌کند؛ حساب‌ها، اعتبار، پرداخت و داده‌ها در هر دو تم یکی است.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map(theme => {
          const selected = state.active === theme.id;
          return (
            <button key={theme.id} type="button" disabled={busy || selected} aria-pressed={selected} onClick={() => { if (confirm(`تم سایت برای همهٔ کاربران «${theme.title}» شود؟`)) void send({ active: theme.id }); }}
              className="text-right rounded-2xl p-4 transition-all disabled:cursor-default"
              style={{ background: selected ? "rgba(234,88,12,0.10)" : "var(--surface-2)", border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}` }}>
              <div className="flex items-center justify-between gap-2">
                <strong style={{ color: "var(--text-primary)" }}>{theme.title}</strong>
                {selected && <span className="flex items-center gap-1 text-xs" style={{ color: "var(--primary)" }}><Check className="w-3.5 h-3.5" />فعال برای همه</span>}
              </div>
              <p className="text-xs mt-2 leading-6" style={{ color: "var(--text-secondary)" }}>{theme.text}</p>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <strong className="text-sm" style={{ color: "var(--text-primary)" }}>پیش‌نمایش فقط برای خودم</strong>
        <p className="text-xs leading-6" style={{ color: "var(--text-muted)" }}>بدون تغییر سایت برای کاربران، فقط در همین مرورگر یک تم را ببینید.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void send({ preview: "v2" })} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ background: state.preview === "v2" ? "var(--primary)" : "var(--surface-1)", color: state.preview === "v2" ? "#fff" : "var(--text-secondary)" }}><Eye className="w-4 h-4" />دیدن طراحی جدید</button>
          <button type="button" disabled={busy} onClick={() => void send({ preview: "classic" })} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ background: state.preview === "classic" ? "var(--primary)" : "var(--surface-1)", color: state.preview === "classic" ? "#fff" : "var(--text-secondary)" }}><Eye className="w-4 h-4" />دیدن تم کلاسیک</button>
          {state.preview && <button type="button" disabled={busy} onClick={() => void send({ preview: null })} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}><EyeOff className="w-4 h-4" />پایان پیش‌نمایش</button>}
        </div>
      </div>
      <p className="text-xs leading-6" role="status" style={{ color: "var(--text-secondary)" }}>{status}</p>
      {ready > 0 && <p className="text-xs leading-6" dir="ltr" style={{ color: "var(--text-muted)" }}>{state.readyRoutes.join("  ·  ")}</p>}
    </div>
  );
}
