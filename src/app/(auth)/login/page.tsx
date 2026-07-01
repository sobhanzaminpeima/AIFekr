"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Mail, Eye, EyeOff, Sparkles, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

type Mode = "phone" | "email";
type Step = "input" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("email");
  const [step, setStep] = useState<Step>("input");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function handleSendOtp() {
    if (!phone || phone.length < 10) {
      toast.error("شماره موبایل معتبر وارد کنید");
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
      toast.success("کد تأیید ارسال شد");
      if (data.dev_code) setDevCode(data.dev_code);
      setStep("otp");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در ارسال کد");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 4) {
      toast.error("کد ۴ رقمی وارد کنید");
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
      toast.success("ورود موفق");
      const role = data.user?.role;
      window.location.href = (role === "ADMIN" || role === "SUPER_ADMIN") ? "/admin/dashboard" : "/chat";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "کد اشتباه است");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin() {
    if (!email || !password) {
      toast.error("ایمیل و رمز عبور را وارد کنید");
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
      toast.success("ورود موفق");
      window.location.href = "/chat";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ایمیل یا رمز اشتباه است");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface-0)" }}>
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
            <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>هوشمند AI</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>وارد حساب کاربری خود شوید</p>
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
                موبایل
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
                ایمیل
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
                بازگشت
              </button>
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>کد تأیید</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                کد ۴ رقمی ارسال‌شده به <span className="font-mono">{phone}</span> را وارد کنید
              </p>
              {devCode && (
                <div className="mt-3 px-4 py-2 rounded-xl flex items-center gap-3" style={{ background: "rgba(234,88,12,0.1)", border: "1px dashed rgba(234,88,12,0.4)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>کد تست:</span>
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
                    <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>شماره موبایل</label>
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
                    {loading ? "در حال ارسال..." : "ارسال کد تأیید"}
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
                    {loading ? "در حال بررسی..." : "تأیید و ورود"}
                  </button>
                  <button
                    onClick={handleSendOtp}
                    className="w-full py-2 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    ارسال مجدد کد
                  </button>
                </>
              )}
            </div>
          )}

          {/* Email flow */}
          {mode === "email" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>ایمیل</label>
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
                <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>رمز عبور</label>
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
                {loading ? "در حال ورود..." : "ورود"}
              </button>
            </div>
          )}

          {/* Register link */}
          <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
            حساب کاربری ندارید؟{" "}
            <a href="/register" style={{ color: "var(--primary)" }} className="font-medium">
              ثبت‌نام کنید
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
