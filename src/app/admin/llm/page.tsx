"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, CheckCircle, XCircle, RefreshCw, Info, ArrowRight, Power, Code2, Hash, Palette, Globe, Briefcase, Brain, Flame, RotateCcw, Search, Settings2, Flag, ImageIcon, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import toast from "react-hot-toast";

const PROVIDERS = [
  {
    id: "gpt5",
    name: "GPT-5",
    provider: "OpenAI (via GitHub)",
    model: "gpt-5",
    envKey: "GITHUB_TOKEN_GPT5",
    description: "جدیدترین و قوی‌ترین مدل OpenAI. بهترین برای کد و استدلال.",
    strengths: ["code", "reasoning", "creative", "complex"],
    maxTokens: 4096,
    creditCost: 5,
    color: "#10b981",
    logoText: "GP",
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek (via GitHub)",
    model: "DeepSeek-V3-0324",
    envKey: "GITHUB_TOKEN_DEEPSEEK",
    description: "قوی‌ترین مدل متن‌باز برای کد و ریاضیات.",
    strengths: ["code", "math", "technical", "reasoning"],
    maxTokens: 4096,
    creditCost: 2,
    color: "#3b82f6",
    logoText: "DS",
  },
  {
    id: "deepseek-direct",
    name: "DeepSeek Direct",
    provider: "DeepSeek API",
    model: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
    description: "اتصال مستقیم به API رسمی DeepSeek. پشتیبان DeepSeek V3.",
    strengths: ["code", "math", "general"],
    maxTokens: 4096,
    creditCost: 2,
    color: "#3b82f6",
    logoText: "DD",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    provider: "OpenRouter / Gemini 2.5 Pro",
    model: "google/gemini-2.5-pro-preview",
    envKey: "OPENROUTER_API_KEY",
    description: "دسترسی به صدها مدل AI از یک API. پیش‌فرض: Gemini 2.5 Pro.",
    strengths: ["creative", "translation", "general", "multimodal"],
    maxTokens: 3000,
    creditCost: 4,
    color: "#8b5cf6",
    logoText: "OR",
  },
  {
    id: "gemini",
    name: "Gemini 3.5 Flash",
    provider: "Google AI",
    model: "gemini-3.5-flash",
    envKey: "GEMINI_API_KEY",
    description: "سریع‌ترین مدل Google. بهترین برای ترجمه و محتوای خلاق.",
    strengths: ["creative", "translation", "fast", "factual"],
    maxTokens: 4096,
    creditCost: 1,
    color: "#f59e0b",
    logoText: "GM",
  },
];

const ROUTING_TABLE = [
  { type: "code / کد", primary: "DeepSeek V3", fallback: "GPT-5 → DeepSeek Direct → Claude Sonnet" },
  { type: "math / ریاضی", primary: "DeepSeek V3", fallback: "DeepSeek Direct → GPT-5 → Claude Sonnet" },
  { type: "creative / خلاق", primary: "GPT-5", fallback: "OpenRouter → Gemini → Claude Opus" },
  { type: "translation / ترجمه", primary: "Gemini", fallback: "OpenRouter → GPT-5 → DeepSeek V3" },
  { type: "business / کسب‌وکار", primary: "GPT-5", fallback: "OpenRouter → Gemini" },
  { type: "complex / پیچیده", primary: "GPT-5", fallback: "OpenRouter → DeepSeek V3" },
  { type: "fast / سریع", primary: "Gemini", fallback: "DeepSeek Direct → DeepSeek V3" },
  { type: "general / عمومی", primary: "GPT-5", fallback: "Gemini → OpenRouter → DeepSeek V3" },
];

const STRENGTH_META: Record<string, { label: string; Icon: LucideIcon }> = {
  code:        { label: "کد",          Icon: Code2 },
  math:        { label: "ریاضی",       Icon: Hash },
  creative:    { label: "خلاق",        Icon: Palette },
  translation: { label: "ترجمه",       Icon: Globe },
  business:    { label: "کسب‌وکار",    Icon: Briefcase },
  complex:     { label: "پیچیده",      Icon: Brain },
  fast:        { label: "سریع",        Icon: Flame },
  general:     { label: "عمومی",       Icon: RotateCcw },
  reasoning:   { label: "استدلال",     Icon: Search },
  technical:   { label: "تکنیکال",    Icon: Settings2 },
  fa:          { label: "فارسی",       Icon: Flag },
  multimodal:  { label: "چندرسانه‌ای", Icon: ImageIcon },
  factual:     { label: "اطلاعاتی",   Icon: BookOpen },
};

type TestStatus = "ok" | "fail" | "testing" | null;

export default function LlmPage() {
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [disabledProviders, setDisabledProviders] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    fetch("/api/admin/llm/config", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.disabled) setDisabledProviders(new Set(data.disabled));
      })
      .catch(() => {});
  }, []);

  async function testProvider(id: string): Promise<boolean> {
    setTestStatus((p) => ({ ...p, [id]: "testing" }));
    try {
      const res = await fetch(`/api/admin/llm/test?provider=${id}`, { credentials: "include" });
      const data = await res.json();
      const ok = data.ok === true;
      setTestStatus((p) => ({ ...p, [id]: ok ? "ok" : "fail" }));
      return ok;
    } catch {
      setTestStatus((p) => ({ ...p, [id]: "fail" }));
      return false;
    }
  }

  async function testAndAutoToggle(id: string, name: string) {
    const ok = await testProvider(id);
    if (ok) {
      toast.success(`${name} — اتصال موفق ✓`);
      // Auto-enable if test passes
      await setEnabled(id, true);
    } else {
      toast.error(`${name} — اتصال ناموفق ✗`);
      // Auto-disable if test fails
      await setEnabled(id, false);
    }
  }

  const setEnabled = useCallback(async (providerId: string, enabled: boolean) => {
    setTogglingId(providerId);
    try {
      const res = await fetch("/api/admin/llm/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, enabled }),
      });
      const data = await res.json();
      if (data.ok) {
        setDisabledProviders(new Set(data.disabled));
      }
    } catch {
      toast.error("خطا در ذخیره تنظیمات");
    } finally {
      setTogglingId(null);
    }
  }, []);

  async function toggleProvider(id: string, currentlyEnabled: boolean) {
    const name = PROVIDERS.find((p) => p.id === id)?.name ?? id;
    await setEnabled(id, !currentlyEnabled);
    toast.success(`${name} — ${!currentlyEnabled ? "فعال" : "غیرفعال"} شد`);
  }

  async function testAll() {
    setTestingAll(true);
    toast("در حال تست همه provider ها...", { icon: "⚡" });

    for (const p of PROVIDERS) {
      const ok = await testProvider(p.id);
      await setEnabled(p.id, ok);
    }

    setTestingAll(false);
    toast.success("تست کامل شد — provider های کارساز فعال شدند");
  }

  const activeCount = PROVIDERS.filter((p) => !disabledProviders.has(p.id)).length;

  return (
    <div className="p-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت LLM</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            سیستم روتینگ هوشمند — بر اساس نوع سوال، بهترین AI انتخاب می‌شود
          </p>
        </div>
        <button
          onClick={testAll}
          disabled={testingAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <RefreshCw className={`w-4 h-4 ${testingAll ? "animate-spin" : ""}`} />
          {testingAll ? "در حال تست..." : "تست همه و فعال‌سازی خودکار"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "کل Provider ها", value: PROVIDERS.length, color: "#3b82f6" },
          { label: "فعال", value: activeCount, color: "#22c55e" },
          { label: "غیرفعال", value: PROVIDERS.length - activeCount, color: "#ef4444" },
          { label: "OpenAI / DeepSeek / Google", value: "1 + 2 + 2", color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Routing table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Zap className="w-4 h-4" style={{ color: "var(--primary)" }} />
            جدول روتینگ هوشمند
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            وقتی کاربر مدل «خودکار» را انتخاب می‌کند، سیستم بر اساس نوع سوال بهترین AI را انتخاب می‌کند
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {ROUTING_TABLE.map((row) => (
            <div key={row.type} className="px-5 py-3 flex items-center gap-4">
              <div className="w-40 text-xs font-mono shrink-0" style={{ color: "var(--text-secondary)" }}>{row.type}</div>
              <div className="flex items-center gap-2 flex-1">
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}>
                  {row.primary}
                </span>
                <ArrowRight className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{row.fallback}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider cards */}
      <div>
        <h2 className="font-semibold text-sm mb-4" style={{ color: "var(--text-secondary)" }}>همه Provider ها</h2>
        <div className="grid grid-cols-1 gap-3">
          {PROVIDERS.map((p) => {
            const status = testStatus[p.id];
            const isEnabled = !disabledProviders.has(p.id);
            const isTesting = status === "testing";
            const isToggling = togglingId === p.id;

            let borderColor = "var(--border)";
            if (isEnabled && status === "ok") borderColor = "#22c55e60";
            else if (status === "fail") borderColor = "#ef444460";
            else if (isEnabled) borderColor = "rgba(234,88,12,0.3)";

            return (
              <div
                key={p.id}
                className="p-4 rounded-2xl flex items-start gap-4 transition-all"
                style={{
                  background: isEnabled ? "var(--surface-1)" : "var(--surface-0, rgba(0,0,0,0.03))",
                  border: `1px solid ${borderColor}`,
                  opacity: isEnabled ? 1 : 0.55,
                }}
              >
                {/* Logo */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs tracking-wide"
                  style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}30` }}>
                  {p.logoText}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                      {p.provider}
                    </span>
                    {/* Status badge */}
                    {isEnabled ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                        style={{ background: "#22c55e18", color: "#22c55e" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        فعال
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                        style={{ background: "#ef444418", color: "#ef4444" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        غیرفعال
                      </span>
                    )}
                    {status === "ok" && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {status === "fail" && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{p.description}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{p.model}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {p.creditCost} اعتبار · {p.maxTokens.toLocaleString()} توکن
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {p.strengths.map((s) => {
                      const meta = STRENGTH_META[s];
                      if (!meta) return <span key={s} className="text-xs px-2 py-0.5 rounded-lg" style={{ background: `${p.color}15`, color: p.color }}>{s}</span>;
                      const SIcon = meta.Icon;
                      return (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-lg flex items-center gap-1"
                          style={{ background: `${p.color}15`, color: p.color }}>
                          <SIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {p.envKey}
                  </span>

                  {/* Toggle enable/disable */}
                  <button
                    onClick={() => toggleProvider(p.id, isEnabled)}
                    disabled={isToggling || testingAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    style={{
                      background: isEnabled ? "#22c55e18" : "#ef444418",
                      color: isEnabled ? "#22c55e" : "#ef4444",
                      border: `1px solid ${isEnabled ? "#22c55e40" : "#ef444440"}`,
                    }}
                  >
                    <Power className="w-3 h-3" />
                    {isToggling ? "..." : isEnabled ? "غیرفعال کردن" : "فعال کردن"}
                  </button>

                  {/* Test button */}
                  <button
                    onClick={() => testAndAutoToggle(p.id, p.name)}
                    disabled={isTesting || testingAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    <RefreshCw className={`w-3 h-3 ${isTesting ? "animate-spin" : ""}`} />
                    {isTesting ? "تست..." : "تست اتصال"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info box */}
      <div className="p-4 rounded-2xl flex gap-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#3b82f6" }} />
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: "#3b82f6" }}>نحوه کارکرد روتر هوشمند</p>
          <ul className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
            <li>• دکمه «تست همه و فعال‌سازی خودکار» همه provider ها را تست می‌کند و اگر کار کنند فعال، اگر خطا دادند غیرفعال می‌شوند</li>
            <li>• می‌توانید هر provider را دستی فعال یا غیرفعال کنید</li>
            <li>• روتر فقط از provider های فعال استفاده می‌کند</li>
            <li>• اگر provider اول خطا داد، به ترتیب fallback‌های فعال امتحان می‌شوند</li>
            <li>• نام AI انتخاب‌شده بالای چت‌باکس نمایش داده می‌شود</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
