"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, RefreshCw, Coins, Activity, Users, Calculator, ShieldAlert, Save, CheckCircle2 } from "lucide-react";

interface UsageStats {
  days: number;
  totalCalls: number;
  totalTokens: number;
  missingTokenCount: number;
  distinctUsers: number;
  byType: { type: string; calls: number; tokens: number; credits: number }[];
  byModel: { model: string; calls: number; tokens: number }[];
  dailySeries: { day: string; calls: number; tokens: number }[];
  planLimits: Record<string, { dailyChats: number; monthlyImages: number; monthlyVideos: number; monthlyMusics: number; initialCredits: number }>;
}

const PLAN_LABELS: Record<string, string> = { FREE: "رایگان", BASIC: "پایه", PRO: "حرفه‌ای", TEAM: "تیمی" };

export default function AdminUsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  // Cost calculator inputs — defaults are a generic "nano-tier" price point;
  // editable so any provider's real pricing can be plugged in.
  const [inputPrice, setInputPrice] = useState(0.2); // $ per 1M input tokens
  const [cachedPrice, setCachedPrice] = useState(0.02); // $ per 1M cached input tokens
  const [outputPrice, setOutputPrice] = useState(1.25); // $ per 1M output tokens
  const [outputShare, setOutputShare] = useState(30); // % of tokens assumed to be output
  const [cachedShare, setCachedShare] = useState(0); // % of input tokens assumed cached

  // editable plan-limit form state, kept separate from `stats.planLimits`
  // so in-progress edits aren't clobbered by a background refresh
  const [limitsDraft, setLimitsDraft] = useState<UsageStats["planLimits"] | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [savedLimits, setSavedLimits] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usage?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setLimitsDraft((prev) => prev ?? data.planLimits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const updateDraft = (plan: string, field: string, value: number) => {
    setLimitsDraft((prev) => (prev ? { ...prev, [plan]: { ...prev[plan as keyof typeof prev], [field]: value } } : prev));
    setSavedLimits(false);
  };

  const saveLimits = async () => {
    if (!limitsDraft) return;
    setSavingLimits(true);
    setLimitsError(null);
    setSavedLimits(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { planLimits: JSON.stringify(limitsDraft) } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedLimits(true);
      setStats((prev) => (prev ? { ...prev, planLimits: limitsDraft } : prev));
    } catch (e) {
      setLimitsError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setSavingLimits(false);
    }
  };

  const tokens = stats?.totalTokens ?? 0;
  const outputTokens = tokens * (outputShare / 100);
  const inputTokensTotal = tokens - outputTokens;
  const cachedTokens = inputTokensTotal * (cachedShare / 100);
  const freshInputTokens = inputTokensTotal - cachedTokens;

  const estCost =
    (freshInputTokens / 1_000_000) * inputPrice +
    (cachedTokens / 1_000_000) * cachedPrice +
    (outputTokens / 1_000_000) * outputPrice;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Coins className="w-5 h-5" style={{ color: "#ea580c" }} />
            مصرف و هزینهٔ هوش مصنوعی
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            آمار واقعی مصرف از UsageLog + محاسبه‌گر هزینه بر اساس نرخ هر مدل
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: days === d ? "var(--primary)" : "var(--surface-2)", color: days === d ? "white" : "var(--text-secondary)" }}
            >
              {d} روز
            </button>
          ))}
          <button onClick={load} disabled={loading} className="p-2 rounded-lg transition-all disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {stats && (
        <>
          {stats.missingTokenCount > 0 && (
            <div className="flex items-start gap-2 p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                <b className="text-amber-400">{stats.missingTokenCount}</b> از {stats.totalCalls} درخواست در این بازه توکن ثبت‌شده ندارن (رکوردهای قدیمی، قبل از فعال‌سازی ثبت توکن واقعی، یا providerهایی که usage برنمی‌گردونن). عدد توکن زیر فقط شامل درخواست‌هایی‌ه که مقدار واقعی گزارش شده — پس یه کف مصرف واقعیه، نه سقفش.
              </p>
            </div>
          )}

          {/* summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4" style={{ color: "#ea580c" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>کل درخواست‌ها</span></div>
              <div className="text-3xl font-bold" style={{ color: "#ea580c" }}>{stats.totalCalls.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{days} روز اخیر</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Coins className="w-4 h-4" style={{ color: "#8b5cf6" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>کل توکن ثبت‌شده</span></div>
              <div className="text-3xl font-bold" style={{ color: "#8b5cf6" }}>{tokens.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>فقط رکوردهای دارای usage واقعی</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4" style={{ color: "#22c55e" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>کاربران فعال</span></div>
              <div className="text-3xl font-bold" style={{ color: "#22c55e" }}>{stats.distinctUsers}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>حداقل ۱ درخواست</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Calculator className="w-4 h-4" style={{ color: "#fbbf24" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>هزینهٔ تخمینی</span></div>
              <div className="text-3xl font-bold" style={{ color: "#fbbf24" }}>${estCost.toFixed(2)}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>بر اساس نرخ‌های پایین</div>
            </div>
          </div>

          {/* cost calculator */}
          <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Calculator className="w-4 h-4" style={{ color: "var(--primary)" }} />
              محاسبه‌گر هزینه (نرخ‌ها رو با قیمت مدل واقعی خودتون جایگزین کنید)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "ورودی ($/1M توکن)", value: inputPrice, set: setInputPrice, step: 0.01 },
                { label: "ورودی کش‌شده ($/1M)", value: cachedPrice, set: setCachedPrice, step: 0.01 },
                { label: "خروجی ($/1M توکن)", value: outputPrice, set: setOutputPrice, step: 0.01 },
                { label: "سهم خروجی از کل (%)", value: outputShare, set: setOutputShare, step: 1 },
                { label: "سهم کش از ورودی (%)", value: cachedShare, set: setCachedShare, step: 1 },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>{f.label}</label>
                  <input
                    type="number"
                    step={f.step}
                    value={f.value}
                    onChange={(e) => f.set(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              پیش‌فرض‌ها فقط نمونه‌ان. برای اهرم واقعی صرفه‌جویی: پرامپت‌های سیستمی ثابت (BASE_SYSTEM هر عامل) رو کش کنید — این می‌تونه هزینهٔ همون بخش از ورودی رو تا ۱۰ برابر کاهش بده.
            </p>
          </div>

          {/* by type / by model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>مصرف به تفکیک نوع</h3>
              {stats.byType.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>داده‌ای نیست</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>نوع</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>تعداد</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>توکن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byType.map((r) => (
                      <tr key={r.type} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2" style={{ color: "var(--text-primary)" }}>{r.type}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.calls}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>مصرف به تفکیک مدل</h3>
              {stats.byModel.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>داده‌ای نیست</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>مدل</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>تعداد</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>توکن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byModel.map((r) => (
                      <tr key={r.model} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2" style={{ color: "var(--text-primary)" }}>{r.model}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.calls}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* plan limits — editable, persisted to SiteSetting (key "planLimits"), no deploy needed */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>سقف مصرف هر پلن (Limit) — قابل‌ویرایش، بدون نیاز به دیپلوی</span>
              </div>
              <button
                onClick={saveLimits}
                disabled={savingLimits || !limitsDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {savedLimits ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {savingLimits ? "در حال ذخیره…" : savedLimits ? "ذخیره شد" : "ذخیرهٔ تغییرات"}
              </button>
            </div>
            {limitsError && <p className="text-xs px-4 py-2 text-red-400">{limitsError}</p>}
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                  {["پلن", "چت روزانه", "تصویر ماهانه", "ویدیو ماهانه", "موزیک ماهانه", "اعتبار اولیه"].map((h) => (
                    <th key={h} className="px-4 py-2 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(limitsDraft ?? stats.planLimits).map(([plan, limits], i) => (
                  <tr key={plan} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{PLAN_LABELS[plan] ?? plan}</td>
                    {(["dailyChats", "monthlyImages", "monthlyVideos", "monthlyMusics", "initialCredits"] as const).map((field) => (
                      <td key={field} className="px-4 py-1.5">
                        <input
                          type="number"
                          value={limits[field]}
                          onChange={(e) => updateDraft(plan, field, Number(e.target.value))}
                          className="w-24 px-2 py-1.5 rounded-lg text-xs"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs px-4 py-3" style={{ color: "var(--text-muted)", background: "var(--surface-1)" }}>
              برای «نامحدود» عدد <code>-1</code> بذارید. تغییرات فوری روی محدودیت واقعی تولید تصویر/ویدیو/موزیک اثر می‌کنه (چت هنوز بر پایهٔ اعتبار محدود می‌شه، نه شمارش روزانه).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
