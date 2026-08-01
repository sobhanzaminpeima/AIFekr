"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Smartphone, Mail, Eye, EyeOff, Sparkles, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";

type Mode = "phone" | "email";
type Step = "input" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useTranslation();
  const [mode, setMode] = useState<Mode>("email");
  const [step, setStep] = useState<Step>("input");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) toast.error(error);
  }, [searchParams]);

  async function handleSendOtp() {
    if (!phone || phone.length < 10) {
      toast.error(t.auth.login.errPhoneInvalid);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.auth.login.otpSent);
      if (data.dev_code) setDevCode(data.dev_code);
      setStep("otp");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.auth.login.errSendFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 4) {
      toast.error(t.auth.login.errOtpLength);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.auth.login.loginSuccess);
      const role = data.user?.role;
      window.location.href = (role === "ADMIN" || role === "SUPER_ADMIN") ? "/admin/dashboard" : "/chat";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.auth.login.errOtpWrong);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin() {
    if (!email || !password) {
      toast.error(t.auth.login.errFillEmailPass);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t.auth.login.loginSuccess);
      window.location.href = "/chat";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.auth.login.errEmailPassWrong);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={lang === "fa" ? "rtl" : "ltr"} className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface-0)" }}>
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, var(--primary), transparent)" }} />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>AiFekr</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>{t.auth.login.subtitle}</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6">
          {/* Mode tabs */}
          {step === "input" && (
            <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
              <button
                onClick={() => setMode("phone")}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: mode === "phone" ? "var(--primary)" : "transparent",
                  color: mode === "phone" ? "white" : "var(--text-secondary)",
                }}
              >
                <Smartphone className="w-4 h-4" />
                {t.auth.login.tabPhone}
              </button>
              <button
                onClick={() => setMode("email")}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: mode === "email" ? "var(--primary)" : "transparent",
                  color: mode === "email" ? "white" : "var(--text-secondary)",
                }}
              >
                <Mail className="w-4 h-4" />
                {t.auth.login.tabEmail}
              </button>
            </div>
          )}

          {/* OTP header */}
          {step === "otp" && (
            <div className="mb-6">
              <button
                onClick={() => setStep("input")}
                className="flex items-center gap-2 text-sm mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                <ArrowLeft className="w-4 h-4" />
                {t.auth.login.back}
              </button>
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{t.auth.login.otpTitle}</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t.auth.login.otpSentPrefix} <span className="font-mono">{phone}</span> {t.auth.login.otpSentSuffix}
              </p>
              {devCode && (
                <div className="mt-3 px-4 py-2 rounded-xl flex items-center gap-3" style={{ background: "rgba(234,88,12,0.1)", border: "1px dashed rgba(234,88,12,0.4)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.auth.login.testCode}</span>
                  <span className="font-mono font-bold text-lg tracking-widest" style={{ color: "var(--primary)" }}>{devCode}</span>
                </div>
              )}
            </div>
          )}

          {/* Phone + OTP flow */}
          {mode === "phone" && (
            <div className="space-y-4">
              {step === "input" && (
                <>
                  <div>
                    <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{t.auth.login.phoneLabel}</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09123456789"
                      dir="ltr"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    />
                  </div>
                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: "var(--primary)" }}
                  >
                    {loading ? t.auth.login.sending : t.auth.login.sendCode}
                  </button>
                </>
              )}

              {step === "otp" && (
                <>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="۱۲۳۴"
                    dir="ltr"
                    maxLength={4}
                    className="w-full px-4 py-4 rounded-xl text-center text-2xl font-mono tracking-widest outline-none"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 4}
                    className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: "var(--primary)" }}
                  >
                    {loading ? t.auth.login.verifying : t.auth.login.verifyAndLogin}
                  </button>
                  <button
                    onClick={handleSendOtp}
                    className="w-full py-2 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t.auth.login.resendCode}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Email flow */}
          {mode === "email" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{t.auth.login.emailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{t.auth.login.passwordLabel}</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none pr-10"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleEmailLogin}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {loading ? t.auth.login.loggingIn : t.auth.login.submit}
              </button>
            </div>
          )}

          {/* Google sign-in */}
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
            {t.auth.login.googleLogin}
          </a>

          {/* Register link */}
          <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
            {t.auth.login.noAccount}{" "}
            <a href="/register" style={{ color: "var(--primary)" }} className="font-medium">
              {t.auth.login.registerLink}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
