"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";
import { COUNTRIES, dialCodeFor } from "@/lib/constants/countries";

const LANG_OPTIONS: { code: "fa" | "en" | "de" | "tr"; label: string }[] = [
  { code: "fa", label: "فارسی" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang } = useTranslation();
  const isFa = lang === "fa";
  const packSlug = params.get("pack") || "";
  const refCode = params.get("ref") || "";
  const planCode = params.get("plan") || "";
  const billingPeriod = params.get("period") || "";

  const [form, setForm] = useState({ firstName: "", lastName: "", country: "IR", email: "", phone: "", password: "", confirmPassword: "" });
  const [registerLang, setRegisterLang] = useState<"fa" | "en" | "de" | "tr">(lang);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [packName, setPackName] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (packSlug) {
      fetch(`/api/packs/${packSlug}`).then(r => r.json()).then(d => {
        if (d.pack) setPackName(`${d.pack.emoji} ${d.pack.name}`);
      }).catch(() => {});
    }
  }, [packSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return toast.error(t.auth.register.errName);
    if (!form.email && !form.phone) return toast.error(t.auth.register.errEmailOrPhone);
    if (form.email && !form.password) return toast.error(t.auth.register.errPasswordRequired);
    if (form.password && form.password !== form.confirmPassword) return toast.error(t.auth.register.errPasswordMismatch);
    if (form.password && form.password.length < 6) return toast.error(t.auth.register.errPasswordShort);
    if (!agreed) return toast.error(t.auth.register.errMustAgree);

    // Iran's phone stays exactly as typed (existing convention everywhere
    // else in the app); other countries get their dial code composed in,
    // since this is the first place those numbers get any prefix at all.
    const composedPhone = form.phone && form.country !== "IR" && dialCodeFor(form.country)
      ? `${dialCodeFor(form.country)}${form.phone.replace(/^0+/, "")}`
      : form.phone;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName || undefined, country: form.country || undefined,
          language: registerLang,
          email: form.email || undefined, phone: composedPhone || undefined, password: form.password || undefined,
          industryPackSlug: packSlug || undefined, ref: refCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.auth.register.success);
      // The just-chosen language cookie only takes effect on the NEXT
      // navigation's server render -- a client-side route push would still
      // render the old language for a flash. A full reload picks it up cleanly.
      window.location.href = planCode ? `/plans?plan=${planCode}&period=${encodeURIComponent(billingPeriod)}&autobuy=1` : "/chat";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.auth.register.errGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface-0)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, var(--primary), transparent)" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>AiFekr</span>
          </div>
          <h1 className="text-base font-normal" style={{ color: "var(--text-secondary)" }}>{t.auth.register.subtitle}</h1>
          {packName && (
            <div className="mt-3 px-4 py-2 rounded-xl inline-block" style={{ background: "rgba(234,88,12,0.1)", border: "1px solid rgba(234,88,12,0.3)" }}>
              <span className="text-sm" style={{ color: "var(--primary)" }}>{t.auth.register.selectedPack} {packName}</span>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.firstNameLabel}</label>
                <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                  placeholder={t.auth.register.firstNamePlaceholder} className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} required />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.lastNameLabel}</label>
                <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                  placeholder={t.auth.register.lastNamePlaceholder} className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.countryLabel}</label>
              <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">{t.auth.register.countryPlaceholder}</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c[lang] ?? c.en}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.languageLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {LANG_OPTIONS.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setRegisterLang(l.code)}
                    className="py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: registerLang === l.code ? "var(--primary)" : "var(--surface-2)",
                      color: registerLang === l.code ? "white" : "var(--text-secondary)",
                      border: `1px solid ${registerLang === l.code ? "var(--primary)" : "var(--border)"}`,
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.emailLabel}</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="example@email.com" dir="ltr" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.phoneLabel}</label>
              <div className="flex gap-2" dir="ltr">
                {/* Iran keeps its existing plain "09..." convention unchanged
                    (every phone-based flow already assumes that exact format) --
                    the dial-code prefix is only shown for other countries,
                    which previously had no phone-format handling at all. */}
                {form.country !== "IR" && dialCodeFor(form.country) && (
                  <span className="flex items-center px-3 rounded-xl text-sm flex-shrink-0" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {dialCodeFor(form.country)}
                  </span>
                )}
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder={form.country === "IR" ? "09123456789" : "123456789"} dir="ltr" className="flex-1 min-w-0 px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.passwordLabel}</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={t.auth.register.passwordPlaceholder} dir="ltr" className="w-full px-4 py-3 rounded-xl text-sm outline-none pr-10"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {form.password && (
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.auth.register.confirmPasswordLabel}</label>
                <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="••••••••" dir="ltr" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            )}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-orange-500 flex-shrink-0" />
              <span className="text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                {t.auth.register.agreePrefix}{" "}
                <Link href="/terms" target="_blank" style={{ color: "var(--primary)" }}>{t.auth.register.termsLink}</Link>
                {" "}{t.auth.register.and}{" "}
                <Link href="/privacy" target="_blank" style={{ color: "var(--primary)" }}>{t.auth.register.privacyLink}</Link>
                {" "}{t.auth.register.agreeSuffix}
              </span>
            </label>
            <button type="submit" disabled={loading || !agreed}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              {loading ? t.auth.register.creatingAccount : t.auth.register.submit}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.auth.login.or}</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          <a
            href="/api/auth/google"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33C2.44 15.98 5.48 18 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.97H.96A8.997 8.997 0 000 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            {t.auth.register.googleRegister}
          </a>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
            {t.auth.register.haveAccount}{" "}
            <Link href="/login" style={{ color: "var(--primary)" }} className="font-medium">{t.auth.register.loginLink}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
