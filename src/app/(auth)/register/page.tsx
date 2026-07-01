"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const packSlug = params.get("pack") || "";

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [packName, setPackName] = useState("");

  useEffect(() => {
    if (packSlug) {
      fetch(`/api/packs/${packSlug}`).then(r => r.json()).then(d => {
        if (d.pack) setPackName(`${d.pack.emoji} ${d.pack.name}`);
      }).catch(() => {});
    }
  }, [packSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("نام را وارد کنید");
    if (!form.email && !form.phone) return toast.error("ایمیل یا موبایل را وارد کنید");
    if (form.email && !form.password) return toast.error("رمز عبور را وارد کنید");
    if (form.password && form.password !== form.confirmPassword) return toast.error("رمزهای عبور مطابقت ندارند");
    if (form.password && form.password.length < 6) return toast.error("رمز عبور حداقل ۶ کاراکتر باشد");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, password: form.password || undefined, industryPackSlug: packSlug || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("ثبت‌نام موفق! خوش آمدید");
      window.location.href = "/chat";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در ثبت‌نام");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface-0)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, var(--primary), transparent)" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>هوشمند AI</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>ایجاد حساب کاربری جدید</p>
          {packName && (
            <div className="mt-3 px-4 py-2 rounded-xl inline-block" style={{ background: "rgba(234,88,12,0.1)", border: "1px solid rgba(234,88,12,0.3)" }}>
              <span className="text-sm" style={{ color: "var(--primary)" }}>بسته انتخابی: {packName}</span>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>نام و نام خانوادگی *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: علی رضایی" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} required />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>ایمیل</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="example@email.com" dir="ltr" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>موبایل</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="09123456789" dir="ltr" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>رمز عبور</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="حداقل ۶ کاراکتر" dir="ltr" className="w-full px-4 py-3 rounded-xl text-sm outline-none pr-10"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {form.password && (
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>تکرار رمز عبور</label>
                <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="••••••••" dir="ltr" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              {loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
            حساب دارید؟{" "}
            <Link href="/login" style={{ color: "var(--primary)" }} className="font-medium">وارد شوید</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
